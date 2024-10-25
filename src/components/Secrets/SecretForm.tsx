import React from 'react';
import { Form } from '@patternfly/react-core';
import { SelectVariant } from '@patternfly/react-core/deprecated';
import { useFormikContext } from 'formik';
import { DropdownItemObject, SelectInputField } from '../../shared';
import KeyValueFileInputField from '../../shared/components/formik-fields/key-value-file-input-field/KeyValueFileInputField';
import { SecretFormValues, SecretTypeDropdownLabel, K8sSecretType } from '../../types';
import { RawComponentProps } from '../modal/createModalLauncher';
import SecretTypeSelector from './SecretTypeSelector';
import {
  supportedPartnerTasksSecrets,
  getSupportedPartnerTaskKeyValuePairs,
  isPartnerTask,
} from './utils/secret-utils';

type SecretFormProps = RawComponentProps & {
  existingSecrets: string[];
};

const SecretForm: React.FC<React.PropsWithChildren<SecretFormProps>> = ({ existingSecrets }) => {
  const { values, setFieldValue } = useFormikContext<SecretFormValues>();
  const currentTypeRef = React.useRef(values.type);
  const defaultKeyValues = [{ key: '', value: '', readOnlyKey: false }];
  const defaultImageKeyValues = [{ key: '.dockerconfigjson', value: '', readOnlyKey: true }];

  const initialOptions = existingSecrets
    .filter((secret) => secret.type === K8sSecretType[currentTypeRef.current])
    .concat(
      currentTypeRef.current === SecretTypeDropdownLabel.opaque &&
        existingSecrets.find((s) => s.name === 'snyk-secret') === undefined
        ? [supportedPartnerTasksSecrets.snyk]
        : [],
    )
    .map((secret) => ({ value: secret.name, lable: secret.name }));
  const initialOptionsValues = existingSecrets
    .filter((secret) => secret.type === K8sSecretType[currentTypeRef.current])
    .reduce(
      (dictOfSecrets, secret) => {
        dictOfSecrets[secret.name] = secret;
        return dictOfSecrets;
      },
      { 'snyk-secret': supportedPartnerTasksSecrets.snyk },
    );
  const [options, setOptions] = React.useState(initialOptions);

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
            values.secretName &&
              isPartnerTask(values.secretName) &&
              setFieldValue('secretName', '');
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
          if (
            currentTypeRef.current !== values.type ||
            isPartnerTask(values.secretName, initialOptionsValues)
          ) {
            clearKeyValues();
          }
        }}
        onSelect={(e, value) => {
          if (isPartnerTask(value, initialOptionsValues)) {
            setFieldValue('keyValues', [
              ...values.keyValues.filter((kv) => !kv.readOnlyKey && (!!kv.key || !!kv.value)),
              ...getSupportedPartnerTaskKeyValuePairs(value, initialOptionsValues),
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
