import * as React from 'react';
import { Link } from 'react-router-dom';
import { useK8sWatchResource } from '@openshift/dynamic-plugin-sdk-utils';
import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Flex,
  FlexItem,
  Title,
} from '@patternfly/react-core';
import { useReleaseStatus } from '../../hooks/useReleaseStatus';
import { useWorkspaceResource } from '../../hooks/useWorkspaceResource';
import { ReleasePlanGroupVersionKind } from '../../models';
import { Timestamp } from '../../shared/components/timestamp/Timestamp';
import { ReleaseKind } from '../../types';
import { ReleasePlanKind } from '../../types/coreBuildService';
import { calculateDuration } from '../../utils/pipeline-utils';
import { useWorkspaceInfo } from '../../utils/workspace-context-utils';
import MetadataList from '../PipelineRunDetailsView/MetadataList';
import { StatusIconWithText } from '../topology/StatusIcon';

type ReleaseOverviewTabProps = {
  release: ReleaseKind;
};

const getPipelineRunFromRelease = (release: ReleaseKind): string => {
  // backward compatibility until https://issues.redhat.com/browse/RELEASE-1109 is released.
  return release.status?.processing?.pipelineRun ?? release.status?.managedProcessing?.pipelineRun;
};

const ReleaseOverviewTab: React.FC<React.PropsWithChildren<ReleaseOverviewTabProps>> = ({
  release,
}) => {
  const { namespace, workspace } = useWorkspaceInfo();
  const [pipelineRun, prWorkspace] = useWorkspaceResource(getPipelineRunFromRelease(release));
  const [releasePlan, releasePlanLoaded] = useK8sWatchResource<ReleasePlanKind>({
    name: release.spec.releasePlan,
    groupVersionKind: ReleasePlanGroupVersionKind,
    namespace,
  });
  const duration = calculateDuration(
    typeof release.status?.startTime === 'string' ? release.status?.startTime : '',
    typeof release.status?.completionTime === 'string' ? release.status?.completionTime : '',
  );
  const status = useReleaseStatus(release);

  return (
    <>
      <Title headingLevel="h4" className="pf-v5-c-title pf-v5-u-mt-lg pf-v5-u-mb-lg" size="lg">
        Release details
      </Title>
      <Flex className="pf-v5-u-py-lg">
        <FlexItem flex={{ default: 'flex_3' }}>
          <DescriptionList
            data-test="release-details"
            columnModifier={{
              default: '1Col',
            }}
          >
            <DescriptionListGroup>
              <DescriptionListTerm>Labels</DescriptionListTerm>
              <DescriptionListDescription>
                <MetadataList metadata={release.metadata?.labels} />
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Annotations</DescriptionListTerm>
              <DescriptionListDescription>
                <MetadataList metadata={release.metadata?.annotations} />
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Created at</DescriptionListTerm>
              <DescriptionListDescription>
                <Timestamp timestamp={release.metadata.creationTimestamp ?? '-'} />
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Duration</DescriptionListTerm>
              <DescriptionListDescription>{duration ?? '-'}</DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Release Process</DescriptionListTerm>
              <DescriptionListDescription>
                {release.status?.automated ? 'Automatic' : 'Manual'}
              </DescriptionListDescription>
            </DescriptionListGroup>
          </DescriptionList>
        </FlexItem>
        <Flex flex={{ default: 'flex_3' }}>
          <FlexItem flex={{ default: 'flex_3' }}>
            <DescriptionList
              data-test="release-details-col-2"
              columnModifier={{
                default: '1Col',
              }}
            >
              <DescriptionListGroup>
                <DescriptionListTerm>Status</DescriptionListTerm>
                <DescriptionListDescription>
                  <StatusIconWithText
                    status={status}
                    dataTestAttribute={'release-details status'}
                  />
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Release Plan</DescriptionListTerm>
                <DescriptionListDescription>{release.spec.releasePlan}</DescriptionListDescription>
              </DescriptionListGroup>
              {release.spec.snapshot && releasePlanLoaded && (
                <DescriptionListGroup>
                  <DescriptionListTerm>Snapshot</DescriptionListTerm>
                  <DescriptionListDescription>
                    <Link
                      to={`/application-pipeline/workspaces/${workspace}/applications/${releasePlan.spec.application}/snapshots/${release.spec.snapshot}`}
                    >
                      {release.spec.snapshot}
                    </Link>
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}
              <DescriptionListGroup>
                <DescriptionListTerm>Release Target</DescriptionListTerm>
                <DescriptionListDescription>
                  <>{release.status?.target ?? '-'}</>
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Pipeline Run</DescriptionListTerm>
                <DescriptionListDescription>
                  {pipelineRun && prWorkspace && releasePlanLoaded ? (
                    <Link
                      to={`/application-pipeline/workspaces/${prWorkspace}/applications/${releasePlan.spec.application}/pipelineruns/${pipelineRun}`}
                    >
                      {pipelineRun}
                    </Link>
                  ) : (
                    '-'
                  )}
                </DescriptionListDescription>
              </DescriptionListGroup>
            </DescriptionList>
          </FlexItem>
        </Flex>
      </Flex>
    </>
  );
};

export default ReleaseOverviewTab;
