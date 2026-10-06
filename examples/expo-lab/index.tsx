import "@expo/metro-runtime";
import { registerRootComponent } from "expo";
import type React from "react";

import { Application } from "src/Application";
import { startLab } from "src/lab/startLab";

// The application owns one lab, or one Beacon on a device, for its whole life, made outside React.
const start = startLab();

const Root: React.FunctionComponent = () => <Application start={start} />;

registerRootComponent(Root);
