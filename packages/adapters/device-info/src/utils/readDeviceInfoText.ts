import { DEVICE_INFO_NOT_READ } from "src/utils/constants/sentinels";
import { cleanText } from "src/utils/cleanText";

/** What `react-native-device-info` gave, where the text it answers for a value it could not read is no value at all. */
export const readDeviceInfoText = (value: string) => {
  const text = cleanText(value);

  if (text === DEVICE_INFO_NOT_READ) {
    return null;
  }

  return text;
};
