import React from 'react';
import { Form } from '@patternfly/react-core';
import { SelectVariant } from '@patternfly/react-core/deprecated';
import { useFormikContext } from 'formik';
import { useSecrets } from '../../hooks/useSecrets';
import { DropdownItemObject, SelectInputField } from '../../shared';
import KeyValueFileInputField from '../../shared/components/formik-fields/key-value-file-input-field/KeyValueFileInputField';
import { SecretFormValues, SecretTypeDropdownLabel } from '../../types';
import { useWorkspaceInfo } from '../../utils/workspace-context-utils';
import { RawComponentProps } from '../modal/createModalLauncher';
import SecretTypeSelector from './SecretTypeSelector';
import { secretsList } from './utils/secret-utils';

type SecretFormProps = RawComponentProps & {
  existingSecrets: string[];
};

const SecretForm: React.FC<React.PropsWithChildren<SecretFormProps>> = ({ existingSecrets }) => {
  const { values, setFieldValue } = useFormikContext<SecretFormValues>();
  const { namespace } = useWorkspaceInfo();
  const [secrets, secretsLoaded] = useSecrets(namespace);

  const defaultKeyValues = [{ key: '', value: '', readOnlyKey: false }];
  const defaultImageKeyValues = [{ key: '.dockerconfigjson', value: '', readOnlyKey: true }];

  const sl = secretsLoaded ? secretsList(secrets) : [];
  const initialOptions = Object.values(sl)
    .map((secret) => ({ value: secret.name, label: secret.name }))
    .filter((secret) => !existingSecrets.includes(secret.value));
  const [options, setOptions] = React.useState(initialOptions);
  const currentTypeRef = React.useRef(values.type);

  const isSecretTask = (secretName: string) => {
    return !!Object.values(sl).find((secret) => secret.name === secretName);
  };

  const getSecretsTaskKeyValuePairs = (secretName?: string) => {
    const secretTask = Object.values(sl).find((secret) => secret.name === secretName);
    return secretTask ? secretTask.keyValuePairs : [];
  };

  const clearKeyValues = () => {
    const newKeyValues = values.keyValues.filter((kv) => !kv.readOnlyKey);
    setFieldValue('keyValues', [...(newKeyValues.length ? newKeyValues : defaultKeyValues)]);
  };

  const resetKeyValues = () => {
    setOptions([]);
    const newKeyValues = values.keyValues.filter(
      (kv) => !kv.readOnlyKey && (!!kv.key || !!kv.value),
    );
    setFieldValue('keyValues', [...newKeyValues, ...defaultImageKeyValues]);
  };

  const dropdownItems: DropdownItemObject[] = Object.entries(SecretTypeDropdownLabel).reduce(
    (acc, [key, value]) => {
      value !== SecretTypeDropdownLabel.source && acc.push({ key, value });
      return acc;
    },
    [],
  );

  return (
    <Form>
      <SecretTypeSelector
        dropdownItems={dropdownItems}
        onChange={(type) => {
          currentTypeRef.current = type;
          if (type === SecretTypeDropdownLabel.image) {
            resetKeyValues();
            values.secretName && isSecretTask(values.secretName) && setFieldValue('secretName', '');
          } else {
            setOptions(initialOptions);
            clearKeyValues();
          }
        }}
      />
      <SelectInputField
        required
        key={values.type}
        name="secretName"
        label="Select or enter secret name"
        helpText="Unique name of the new secret."
        isCreatable
        isInputValuePersisted
        hasOnCreateOption
        options={options}
        variant={SelectVariant.typeahead}
        toggleId="secret-name-toggle"
        toggleAriaLabel="secret-name-dropdown"
        onClear={() => {
          if (currentTypeRef.current !== values.type || isSecretTask(values.secretName)) {
            clearKeyValues();
          }
        }}
        onSelect={(e, value) => {
          if (isSecretTask(value)) {
            setFieldValue('keyValues', [
              ...values.keyValues.filter((kv) => !kv.readOnlyKey && (!!kv.key || !!kv.value)),
              ...getSecretsTaskKeyValuePairs(value),
            ]);
          }
          setFieldValue('secretName', value);
        }}
      />
      <KeyValueFileInputField
        name="keyValues"
        data-test="secret-key-value-pair"
        entries={defaultKeyValues}
        disableRemoveAction={values.keyValues.length === 1}
      />
    </Form>
  );
};

export default SecretForm;
