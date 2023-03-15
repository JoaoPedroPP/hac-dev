import { useK8sWatchResource } from '@openshift/dynamic-plugin-sdk-utils';
import '@testing-library/jest-dom';
import { renderHook } from '@testing-library/react-hooks';
import { mockIntegrationTestScenariosData } from '../../../../../__data__';
import { testPipelineRuns } from '../__data__/test-pipeline-data';
import { useAppApplicationTestNodes } from '../useAppApplicationTestNodes';

jest.mock('@openshift/dynamic-plugin-sdk-utils', () => ({
  useK8sWatchResource: jest.fn(),
}));

const useK8sWatchResourceMock = useK8sWatchResource as jest.Mock;

describe('useAppApplicationTestNodes', () => {
  beforeEach(() => {
    useK8sWatchResourceMock
      .mockReturnValueOnce([[mockIntegrationTestScenariosData[0]], true])
      .mockReturnValueOnce([testPipelineRuns, true]);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should return integration test nodes', () => {
    const { result } = renderHook(() =>
      useAppApplicationTestNodes('test-ns', 'test-dev-samples', [], false),
    );
    const [nodes, appTests, resources, loaded] = result.current;

    expect(nodes).toHaveLength(1);
    expect(appTests).toHaveLength(0);
    expect(resources).toHaveLength(1);
    expect(loaded).toBe(true);
  });

  it('should return failed status', () => {
    const failedPipelinerun = testPipelineRuns[0];
    jest.resetAllMocks();

    useK8sWatchResourceMock
      .mockReturnValueOnce([[mockIntegrationTestScenariosData[0]], true])
      .mockReturnValueOnce([[failedPipelinerun], true]);

    const { result } = renderHook(() =>
      useAppApplicationTestNodes('test-ns', 'test-dev-samples', [], false),
    );

    const [nodes] = result.current;

    expect(nodes[0].data.status).toBe('Failed');
  });

  it('should return status from latest pipelinerun', () => {
    const { result } = renderHook(() =>
      useAppApplicationTestNodes('test-ns', 'test-dev-samples', [], false),
    );
    const [nodes] = result.current;

    expect(nodes[0].data.status).toBe('Succeeded');
  });
});