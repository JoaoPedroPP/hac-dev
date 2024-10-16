import { NavItem } from '../support/constants/PageTitle';
import { ApplicationDetailPage } from '../support/pages/ApplicationDetailPage';
import {
  ComponentDetailsPage,
  ComponentPageTabs,
  DeploymentsTab,
} from '../support/pages/ComponentDetailsPage';
import { ComponentPage } from '../support/pages/ComponentsPage';
import { SecretsPage } from '../support/pages/SecretsPage';
import { ComponentsTabPage } from '../support/pages/tabs/ComponentsTabPage';
import { IntegrationTestsTabPage } from '../support/pages/tabs/IntegrationTestsTabPage';
import { LatestCommitsTabPage } from '../support/pages/tabs/LatestCommitsTabPage';
import {
  DetailsTab,
  PipelinerunsTabPage,
  TaskRunsTab,
} from '../support/pages/tabs/PipelinerunsTabPage';
import { githubAPIEndpoints } from '../utils/APIEndpoints';
import { APIHelper } from '../utils/APIHelper';
import { Applications } from '../utils/Applications';
import { Common } from '../utils/Common';
import { UIhelper } from '../utils/UIhelper';

describe('Advanced Happy path', () => {
  const applicationName = Common.generateAppName();
  const applicationDetailPage = new ApplicationDetailPage();
  const componentPage = new ComponentPage();
  const latestCommitsTabPage = new LatestCommitsTabPage();
  const integrationTestsTabPage = new IntegrationTestsTabPage();
  const sourceOwner = 'hac-test';
  const sourceRepo = 'devfile-sample-go-basic';
  const repoName = Common.generateAppName('devfile-sample-go-basic');
  const repoOwner = 'redhat-hac-qe';
  const repoLink = `https://github.com/${repoOwner}/${repoName}`;
  const gitHubUser = Cypress.env('GH_USERNAME');
  const componentName = Common.generateAppName('go');
  const pipeline = 'docker-build';
  const dockerfilePath = 'docker/Dockerfile';

  after(function () {
    // If some test failed, don't remove the app
    let allTestsSucceeded = true;
    this.test.parent.eachTest((test) => {
      if (test.state === 'failed') {
        allTestsSucceeded = false;
      }
    });
    if (allTestsSucceeded || Cypress.env('REMOVE_APP_ON_FAIL')) {
      Applications.deleteApplication(applicationName);
      APIHelper.deleteGitHubRepository(repoName);
    }
  });

  const componentInfo: { [key: string]: string } = {
    deploymentBodyOriginal: 'Hello World!',
    deploymentBodyUpdated: 'Bye World!',
    filePath: 'main.go',
    firstCommitTitle: 'firstCommit',
    firstCommitMessage: 'This PR was auto-generated by appstudio-ci__bot',
    updatedCommitMessage: 'secondCommit',
  };

  const integrationTestDetails: { [key: string]: string } = {
    integrationTestName: Common.generateAppName('integration-tests'),
    integrationTestNameTemp: Common.generateAppName('integration-tests-temp'),
    githubURL: 'https://github.com/redhat-hac-qe/integration-examples',
    pathInRepository: 'pipelines/integration_pipeline_pass.yaml',
  };

  const integrationTestTaskNames = ['task-success', 'task-success-2', 'task-skipped'];
  const vulnerabilities = /Critical(\d+).*High(\d+).*Medium(\d+).*Low(\d+)/g;
  const secret = {
    secretName: 'snyk-secret',
    key: 'snyk_token',
    value: `${Cypress.env('SNYK_TOKEN')}`,
  };

  before(() => {
    APIHelper.createRepositoryFromTemplate(sourceOwner, sourceRepo, repoOwner, repoName);
    APIHelper.githubRequest(
      'GET',
      githubAPIEndpoints.contents(sourceOwner, sourceRepo, componentInfo.filePath),
    ).then((response) => {
      componentInfo.goFileSHAOriginal = response.body.sha;
      componentInfo.goFileBase64Original = response.body.content;
    });
  });

  it('Create clean application and add a component', () => {
    Applications.createCleanApp(applicationName);
    Applications.goToOverviewTab().addComponent();
    Applications.createComponent(
      repoLink,
      componentName,
      pipeline,
      false,
      undefined,
      dockerfilePath,
      secret,
    );
  });

  describe('Trigger a new Pipelinerun related to push event', () => {
    it('Merge the auto-generated PR, and verify the event status on modal', () => {
      Applications.goToComponentsTab();
      componentPage.openPipelinePlanModal();
      componentPage.verifyAndWaitForPRIsSent();

      APIHelper.mergePR(
        repoOwner,
        repoName,
        1,
        componentInfo.firstCommitTitle,
        componentInfo.firstCommitMessage,
      );

      componentPage.verifyAndWaitForPRMerge();

      componentPage.closeModal();
    });

    it('Validate the component', () => {
      Applications.checkComponentInListView(componentName, applicationName, 'Build running');
    });

    it('Verify the Pipeline run details and Task runs', () => {
      Applications.goToPipelinerunsTab();
      cy.contains(`${componentName}-on-push`)
        .invoke('text')
        .then((pipelinerunName) => {
          componentInfo.firstPipelineRunName = pipelinerunName;
          UIhelper.clickLink(componentInfo.firstPipelineRunName);
          DetailsTab.waitForPLRAndDownloadAllLogs();

          TaskRunsTab.goToTaskrunsTab();
          TaskRunsTab.assertTaskAndTaskRunStatus(
            TaskRunsTab.getAdvancedTaskNamesList(componentInfo.firstPipelineRunName),
          );
        });
    });
  });

  describe('Verify SBOM on pipeline run details', () => {
    before(() => {
      UIhelper.clickTab('Details');
    });

    // skipping due to https://issues.redhat.com/browse/HAC-5807
    it.skip('Verify SBOM and logs', () => {
      UIhelper.clickLink('View SBOM');
      DetailsTab.verifyLogs('"bomFormat": "CycloneDX"');
    });

    it('Execute and validate using Cosign', () => {
      Applications.clickBreadcrumbLink(componentInfo.firstPipelineRunName);
      DetailsTab.downloadSBOMAndCheckUsingCosign();
    });
  });

  describe('Verify CVE scan', () => {
    it('Verify clair scan node details on drawer Panel', () => {
      DetailsTab.clickOnNode('clair-scan');
      DetailsTab.checkVulScanOnClairDrawer(vulnerabilities);
      DetailsTab.checkNodeDrawerPanelResult('TEST_OUTPUT', '"result":"SUCCESS"');
      DetailsTab.clickOnDrawerPanelLogsTab();
      DetailsTab.verifyLogs('Task clair-scan completed');
      DetailsTab.closeDrawerPanel();
    });

    it('Verify vulnerabilities on pipeline run Details Page', () => {
      DetailsTab.checkVulScanOnPipelinerunDetails(vulnerabilities);
      DetailsTab.clickOnVulScanViewLogs();
      DetailsTab.verifyLogs('Task clair-scan completed');
    });

    // skipping due to https://issues.redhat.com/browse/HAC-5808
    it.skip('Verify vulnerabilities on pipeline run list', () => {
      Applications.clickBreadcrumbLink('Pipeline runs');
      UIhelper.verifyRowInTable('Pipeline run List', componentInfo.firstPipelineRunName, [
        vulnerabilities,
      ]);
    });

    it('Verify Enterprise contract Test pipeline run Details', () => {
      Applications.clickBreadcrumbLink('Pipeline runs');
      UIhelper.clickRowCellInTable('Pipeline run List', 'Test', `${applicationName}-`);
      DetailsTab.waitForPLRAndDownloadAllLogs(false);
    });
  });

  describe('Check Component Deployment', () => {
    before(() => {
      Applications.clickBreadcrumbLink(applicationName);
      Applications.goToComponentsTab();
      ComponentsTabPage.openComponent(componentName);
    });

    after(() => {
      Applications.clickBreadcrumbLink(applicationName);
    });

    it('Verify SBOM on components tab', () => {
      ComponentDetailsPage.openTab(ComponentPageTabs.detail);
      ComponentDetailsPage.checkSBOM();
    });
  });

  describe('Add and edit integration test', () => {
    before(() => {
      Applications.clickBreadcrumbLink(applicationName);
      UIhelper.clickTab('Integration tests');
    });

    it('Add integration test and verify', () => {
      integrationTestsTabPage.clickOnAddIntegrationTestBtn();
      integrationTestsTabPage.addIntegrationTest(
        integrationTestDetails.integrationTestName,
        integrationTestDetails.githubURL,
        'main',
        integrationTestDetails.pathInRepository,
        'check',
      );
      integrationTestsTabPage.verifyRowInIntegrationTestsTable({
        name: integrationTestDetails.integrationTestName,
        githubURL: integrationTestDetails.githubURL,
        optionalForRelease: 'Optional',
        revision: 'main',
      });
    });

    it('Add integration test from Actions and verify', () => {
      Applications.clickActionsDropdown('Add integration test');
      integrationTestsTabPage.addIntegrationTest(
        integrationTestDetails.integrationTestNameTemp,
        integrationTestDetails.githubURL,
        'main',
        integrationTestDetails.pathInRepository,
      );
      integrationTestsTabPage.verifyRowInIntegrationTestsTable({
        name: integrationTestDetails.integrationTestNameTemp,
        githubURL: integrationTestDetails.githubURL,
        optionalForRelease: 'Mandatory',
        revision: 'main',
      });
    });

    it('Edit integration test and verify', () => {
      integrationTestsTabPage.openAndClickKebabMenu(
        integrationTestDetails.integrationTestName,
        'Edit',
      );
      Common.waitForLoad();
      integrationTestsTabPage.editIntegrationTest(integrationTestDetails.githubURL, 'uncheck');
      integrationTestsTabPage.verifyRowInIntegrationTestsTable({
        name: integrationTestDetails.integrationTestName,
        githubURL: integrationTestDetails.githubURL,
        optionalForRelease: 'Mandatory',
        revision: 'main',
      });
    });

    it('Delete one of integration test and verify', () => {
      UIhelper.clickLink(integrationTestDetails.integrationTestNameTemp);
      integrationTestsTabPage.deleteIntegrationTestFromActions();
      Common.waitForLoad();
      cy.contains(integrationTestDetails.integrationTestNameTemp).should('not.exist');
    });
  });

  describe('Add a new commit and verify Build Pipeline run', () => {
    before(() => {
      const goFileUpdated = Buffer.from(componentInfo.goFileBase64Original, 'base64')
        .toString('utf8')
        .replace(componentInfo.deploymentBodyOriginal, componentInfo.deploymentBodyUpdated);

      latestCommitsTabPage.editFile(
        repoLink,
        componentInfo.filePath,
        componentInfo.updatedCommitMessage,
        Buffer.from(goFileUpdated).toString('base64'),
        componentInfo.goFileSHAOriginal,
      );
      Applications.goToPipelinerunsTab();
    });

    it('Verify and wait for the new Pipeline run', () => {
      UIhelper.getTableRow('Pipeline run List', /Running|Pending/)
        .contains(`${componentName}-on-push`)
        .invoke('text')
        .then((pipelinerunName) => {
          componentInfo.secondPipelineRunName = pipelinerunName;
          UIhelper.clickLink(componentInfo.secondPipelineRunName);
          DetailsTab.waitForPLRAndDownloadAllLogs();
          TaskRunsTab.goToTaskrunsTab();
          TaskRunsTab.assertTaskAndTaskRunStatus(
            TaskRunsTab.getAdvancedTaskNamesList(componentInfo.secondPipelineRunName),
          );
        });
    });
  });

  describe('Verify Integration Test Pipeline Runs on Activity Tab', () => {
    before(() => {
      Applications.clickBreadcrumbLink('Pipeline runs');
    });

    it('Verify Integration Test pipeline run Details', () => {
      PipelinerunsTabPage.getPipelineRunNameByLabel(
        applicationName,
        `test.appstudio.openshift.io/scenario=${integrationTestDetails.integrationTestName}`,
        {
          key: 'pac.test.appstudio.openshift.io/event-type',
          value: 'push',
        },
      ).then((testPipelineName) => {
        integrationTestDetails.passIntegrationTestPipelineRunName = testPipelineName;
        UIhelper.verifyRowInTable('Pipeline run List', testPipelineName, [/^Test$/]);
        UIhelper.clickLink(testPipelineName);
      });
      DetailsTab.waitForPLRAndDownloadAllLogs();
      UIhelper.verifyLabelAndValue('Related pipelines', '2 pipelines').click();
      PipelinerunsTabPage.verifyRelatedPipelines(componentInfo.secondPipelineRunName);
    });

    it('Verify Integration Test pipeline run graph', () => {
      UIhelper.verifyGraphNodes(integrationTestTaskNames[0]);
      UIhelper.verifyGraphNodes(integrationTestTaskNames[1]);
      UIhelper.verifyGraphNodes(integrationTestTaskNames[2], false);
    });

    it('Verify Integration Test pipeline runs Task runs & Logs Tab', () => {
      UIhelper.clickTab('Task runs');
      TaskRunsTab.assertTaskAndTaskRunStatus([
        {
          name: new RegExp(`${applicationName}-.*-${integrationTestTaskNames[0]}`),
          task: integrationTestTaskNames[0],
          status: 'Succeeded',
        },
        {
          name: new RegExp(`${applicationName}-.*-${integrationTestTaskNames[1]}`),
          task: integrationTestTaskNames[1],
          status: 'Succeeded',
        },
      ]);
      UIhelper.clickTab('Logs');
      applicationDetailPage.verifyBuildLogTaskslist(integrationTestTaskNames);
    });
  });

  describe('Verify Enterprise Contract Integration Test Pipeline Runs on Activity Tab', () => {
    before(() => {
      Applications.clickBreadcrumbLink('Pipeline runs');
    });

    it('Verify EC Integration Test pipeline run Details', () => {
      PipelinerunsTabPage.getPipelineRunNameByLabel(
        applicationName,
        `test.appstudio.openshift.io/scenario=${applicationName}-enterprise-contract`,
        {
          key: 'pac.test.appstudio.openshift.io/sha-title',
          value: componentInfo.updatedCommitMessage,
        },
      ).then((testPipelineName) => {
        integrationTestDetails.enterpriseContractITPipelineRunName = testPipelineName;
        UIhelper.verifyRowInTable('Pipeline run List', testPipelineName, [/^Test$/]);
        UIhelper.clickLink(testPipelineName);
        DetailsTab.waitForPLRAndDownloadAllLogs(false);
        UIhelper.verifyLabelAndValue('Pipeline', 'enterprise-contract');
        UIhelper.verifyLabelAndValue('Related pipelines', '2 pipelines').click();
        PipelinerunsTabPage.verifyRelatedPipelines(
          integrationTestDetails.passIntegrationTestPipelineRunName,
        );
      });
    });

    it('Verify EC Integration Test pipeline runs Logs Tab', () => {
      UIhelper.clickTab('Logs');
      DetailsTab.verifyLogs('"result": "SUCCESS"');
    });

    it('Verify EC Integration Test pipeline runs Security Tab', () => {
      UIhelper.clickTab('Security');
      PipelinerunsTabPage.verifyECSecurityRulesResultSummary(
        /Failed(\d+).*Warning(\d+).*Success(\d+)/g,
      );
      PipelinerunsTabPage.verifyECSecurityRules('Attestation signature check passed', {
        rule: 'Attestation signature check passed',
        status: 'Success',
        message: '-',
      });
    });
  });

  describe('Verify Integration Test Details on Integration tests Tab', () => {
    before(() => {
      Applications.clickBreadcrumbLink(applicationName);
    });

    it('Verify Integration Tests Overview page', () => {
      UIhelper.clickTab('Integration tests');
      UIhelper.clickLink(integrationTestDetails.integrationTestName);
      UIhelper.verifyLabelAndValue('Name', integrationTestDetails.integrationTestName);
      UIhelper.verifyLabelAndValue('GitHub URL', integrationTestDetails.githubURL);
      UIhelper.verifyLabelAndValue('Path in repository', integrationTestDetails.pathInRepository);
      UIhelper.verifyLabelAndValue('Optional for release', 'Mandatory');
    });

    it('Verify Integration Tests Pipeline runs page', () => {
      UIhelper.clickTab('Pipeline runs');
      UIhelper.verifyRowInTable(
        'Pipeline run List',
        `${integrationTestDetails.integrationTestName}-`,
        [/Succeeded/, /^Test$/],
      );
    });
  });

  describe('Verify new commit updates in Components Tab', () => {
    before(() => {
      Applications.clickBreadcrumbLink(applicationName);
      Applications.goToComponentsTab();
      ComponentsTabPage.openComponent(componentName);
    });

    it('Verify Commit Trigger', () => {
      ComponentDetailsPage.openTab(ComponentPageTabs.detail);
      UIhelper.verifyLabelAndValue('Triggered by', componentInfo.updatedCommitMessage);
      UIhelper.verifyLabelAndValue('Build trigger', 'Automatic');
    });

    it('Verify Commits Tab on component Details page', () => {
      ComponentDetailsPage.openTab(ComponentPageTabs.activity);
      UIhelper.clickTab('Commits');
      latestCommitsTabPage.verifyLatestCommits([
        { name: componentInfo.firstCommitTitle, component: componentName },
        { name: componentInfo.updatedCommitMessage, component: componentName },
      ]);
    });

    it('Verify Pipeline runs Tab on component Details page', () => {
      UIhelper.clickTab('Pipeline runs', false);
      UIhelper.verifyRowInTable('Pipeline run List', componentInfo.firstPipelineRunName, [
        // skipping due to https://issues.redhat.com/browse/HAC-5808
        // vulnerabilities,
        /Succeeded/,
      ]);
      UIhelper.verifyRowInTable('Pipeline run List', componentInfo.secondPipelineRunName, [
        // skipping due to https://issues.redhat.com/browse/HAC-5808
        // vulnerabilities,
        /Succeeded/,
      ]);
    });
  });

  describe('Verify Latest commits and Pipeline runs in Activity Tab', () => {
    before(() => {
      Applications.clickBreadcrumbLink(applicationName);
      Applications.goToLatestCommitsTab();
    });

    it('Verify the Commits List view should have both the commits', () => {
      latestCommitsTabPage.verifyLatestCommits([
        { name: componentInfo.firstCommitTitle, component: componentName },
        { name: componentInfo.updatedCommitMessage, component: componentName },
      ]);
    });

    it('Verify the Commit Overview Tab of the Last Commit', () => {
      latestCommitsTabPage.clickOnCommit(componentInfo.updatedCommitMessage);
      latestCommitsTabPage.verifyCommitsPageTitleAndStatus(componentInfo.updatedCommitMessage);
      latestCommitsTabPage.verifyCommitID(
        Cypress.env(`${componentInfo.updatedCommitMessage}_SHA`),
        repoLink,
      ); // Commit SHA was stored in dynamic env at latestCommitsTabPage.editFile()
      UIhelper.verifyLabelAndValue('Branch', 'main');
      UIhelper.verifyLabelAndValue('By', gitHubUser);
      UIhelper.verifyLabelAndValue('Status', 'Succeeded');
      latestCommitsTabPage.verifyNodesOnCommitOverview(['commit', `${componentName}-build`]);
    });

    it('Verify the Commit Pipeline runs Tab', () => {
      UIhelper.clickTab('Pipeline runs');
      UIhelper.verifyRowInTable(
        'Pipelinerun List',
        integrationTestDetails.enterpriseContractITPipelineRunName,
        ['Succeeded', 'Test'],
      );
      UIhelper.verifyRowInTable(
        'Pipelinerun List',
        integrationTestDetails.passIntegrationTestPipelineRunName,
        ['Succeeded', 'Test'],
      );
      UIhelper.verifyRowInTable('Pipelinerun List', componentInfo.secondPipelineRunName, [
        'Succeeded',
        'Build',
      ]);
    });
  });

  describe('Verify application Lifecycle nodes on Overview page', () => {
    before(() => {
      Applications.clickBreadcrumbLink(applicationName);
    });

    it('check Lifecycle Nodes', () => {
      UIhelper.verifyGraphNodes('Components', false);
      UIhelper.verifyGraphNodes('Builds');
      UIhelper.verifyGraphNodes('Tests', false);
    });
  });

  describe('Validate secrets', () => {
    before(() => {
      Common.navigateTo(NavItem.secrets);
    });

    it('Verify Secret on Secret List', () => {
      SecretsPage.searchSecret(secret.secretName);
      UIhelper.verifyRowInTable('Secret List', secret.secretName, ['Key/value']);
    });

    it('Delete Secret', () => {
      SecretsPage.deleteSecret(secret.secretName);
    });
  });
});
