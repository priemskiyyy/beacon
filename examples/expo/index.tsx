import "@expo/metro-runtime";
import { registerRootComponent } from "expo";
import { Text, View } from "react-native";

const Root = () => (
  <View>
    <Text testID="hello">hello</Text>
  </View>
);

registerRootComponent(Root);
