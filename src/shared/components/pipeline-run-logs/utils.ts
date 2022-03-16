import { chart_color_black_400 as skippedColor } from '@patternfly/react-tokens/dist/js/chart_color_black_400';
import { chart_color_black_500 as cancelledColor } from '@patternfly/react-tokens/dist/js/chart_color_black_500';
import { chart_color_blue_100 as pendingColor } from '@patternfly/react-tokens/dist/js/chart_color_blue_100';
import { chart_color_blue_300 as runningColor } from '@patternfly/react-tokens/dist/js/chart_color_blue_300';
import { chart_color_green_400 as successColor } from '@patternfly/react-tokens/dist/js/chart_color_green_400';
import { global_danger_color_100 as failureColor } from '@patternfly/react-tokens/dist/js/global_danger_color_100';
import i18next from 'i18next';
import get from 'lodash/get';
import isEmpty from 'lodash/isEmpty';
import { K8sGroupVersionKind, K8sModel } from '../../../dynamic-plugin-sdk';

export const LOG_SOURCE_RESTARTING = 'restarting';
export const LOG_SOURCE_RUNNING = 'running';
export const LOG_SOURCE_TERMINATED = 'terminated';
export const LOG_SOURCE_WAITING = 'waiting';

export const containerToLogSourceStatus = (container): string => {
  if (!container) {
    return LOG_SOURCE_WAITING;
  }
  const { state, lastState } = container;
  if (state.waiting && !isEmpty(lastState)) {
    return LOG_SOURCE_RESTARTING;
  }
  if (state.waiting) {
    return LOG_SOURCE_WAITING;
  }
  if (state.terminated) {
    return LOG_SOURCE_TERMINATED;
  }
  return LOG_SOURCE_RUNNING;
};

export const resourcePathFromModel = (model: K8sModel, name?: string, namespace?: string) => {
  const { plural, namespaced, crd } = model;

  let url = '/k8s/';

  if (!namespaced) {
    url += 'cluster/';
  }

  if (namespaced) {
    url += namespace ? `ns/${namespace}/` : 'all-namespaces/';
  }

  if (crd) {
    url += `${model.apiGroup}~${model.apiVersion}~${model.kind}`;
  } else if (plural) {
    url += plural;
  }

  if (name) {
    // Some resources have a name that needs to be encoded. For instance,
    // Users can have special characters in the name like `#`.
    url += `/${encodeURIComponent(name)}`;
  }

  return url;
};

export enum SucceedConditionReason {
  PipelineRunCancelled = 'PipelineRunCancelled',
  TaskRunCancelled = 'TaskRunCancelled',
  Cancelled = 'Cancelled',
  PipelineRunStopping = 'PipelineRunStopping',
  PipelineRunPending = 'PipelineRunPending',
  TaskRunStopping = 'TaskRunStopping',
  CreateContainerConfigError = 'CreateContainerConfigError',
  ExceededNodeResources = 'ExceededNodeResources',
  ExceededResourceQuota = 'ExceededResourceQuota',
  ConditionCheckFailed = 'ConditionCheckFailed',
}

const color = successColor.value;

export const PodModel: K8sModel = {
  apiVersion: 'v1',
  label: 'Pod',
  // t('public~Pod')
  labelKey: 'public~Pod',
  plural: 'pods',
  abbr: 'P',
  namespaced: true,
  kind: 'Pod',
  id: 'pod',
  labelPlural: 'Pods',
  // t('public~Pods')
  labelPluralKey: 'public~Pods',
};

export const PodGroupVersionKind: K8sGroupVersionKind = {
  version: 'v1',
  kind: 'Pod',
};

export const PipelineRunGroupVersionKind: K8sGroupVersionKind = {
  group: 'tekton.dev',
  version: 'v1beta1',
  kind: 'PipelineRun',
};

export const PipelineRunModel: K8sModel = {
  apiGroup: 'tekton.dev',
  apiVersion: 'v1beta1',
  label: 'PipelineRun',
  // t('PipelineRun')
  labelKey: 'PipelineRun',
  // t('PipelineRuns')
  labelPluralKey: 'PipelineRuns',
  plural: 'pipelineruns',
  abbr: 'PLR',
  namespaced: true,
  kind: 'PipelineRun',
  id: 'pipelinerun',
  labelPlural: 'PipelineRuns',
  crd: true,
  color,
};

// Converts the PipelineRun (and TaskRun) condition status into a human readable string.
// See also tkn cli implementation at https://github.com/tektoncd/cli/blob/release-v0.15.0/pkg/formatted/k8s.go#L54-L83
export const pipelineRunStatus = (pipelineRun): string => {
  const conditions = get(pipelineRun, ['status', 'conditions'], []);
  if (conditions.length === 0) return null;

  const succeedCondition = conditions.find((c) => c.type === 'Succeeded');
  if (!succeedCondition || !succeedCondition.status) {
    return null;
  }
  const status =
    succeedCondition.status === 'True'
      ? 'Succeeded'
      : succeedCondition.status === 'False'
      ? 'Failed'
      : 'Running';

  if (succeedCondition.reason && succeedCondition.reason !== status) {
    switch (succeedCondition.reason) {
      case SucceedConditionReason.PipelineRunCancelled:
      case SucceedConditionReason.TaskRunCancelled:
      case SucceedConditionReason.Cancelled:
        return 'Cancelled';
      case SucceedConditionReason.PipelineRunStopping:
      case SucceedConditionReason.TaskRunStopping:
        return 'Failed';
      case SucceedConditionReason.CreateContainerConfigError:
      case SucceedConditionReason.ExceededNodeResources:
      case SucceedConditionReason.ExceededResourceQuota:
      case SucceedConditionReason.PipelineRunPending:
        return 'Pending';
      case SucceedConditionReason.ConditionCheckFailed:
        return 'Skipped';
      default:
        return status;
    }
  }
  return status;
};
export const pipelineRunFilterReducer = (pipelineRun): string => {
  const status = pipelineRunStatus(pipelineRun);
  return status || '-';
};

export enum runStatus {
  Succeeded = 'Succeeded',
  Failed = 'Failed',
  Running = 'Running',
  'In Progress' = 'In Progress',
  FailedToStart = 'FailedToStart',
  PipelineNotStarted = 'PipelineNotStarted',
  Skipped = 'Skipped',
  Cancelled = 'Cancelled',
  Pending = 'Pending',
  Idle = 'Idle',
}

export const getRunStatusColor = (status: string) => {
  switch (status) {
    case runStatus.Succeeded:
      return { message: i18next.t('Succeeded'), pftoken: successColor };
    case runStatus.Failed:
      return { message: i18next.t('Failed'), pftoken: failureColor };
    case runStatus.FailedToStart:
      return {
        message: i18next.t('PipelineRun failed to start'),
        pftoken: failureColor,
      };
    case runStatus.Running:
      return { message: i18next.t('Running'), pftoken: runningColor };
    case runStatus['In Progress']:
      return { message: i18next.t('Running'), pftoken: runningColor };

    case runStatus.Skipped:
      return { message: i18next.t('Skipped'), pftoken: skippedColor };
    case runStatus.Cancelled:
      return { message: i18next.t('Cancelled'), pftoken: cancelledColor };
    case runStatus.Idle:
    case runStatus.Pending:
      return { message: i18next.t('Pending'), pftoken: pendingColor };
    default:
      return {
        message: i18next.t('PipelineRun not started yet'),
        pftoken: pendingColor,
      };
  }
};
