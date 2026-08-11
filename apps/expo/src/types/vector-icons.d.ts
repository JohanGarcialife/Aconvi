declare module "@expo/vector-icons" {
  import React from "react";
  import { ComponentProps } from "react";
  import { Text } from "react-native";

  export interface IconProps extends ComponentProps<typeof Text> {
    name: string;
    size?: number;
    color?: string;
  }

  export const Ionicons: React.ComponentType<IconProps>;
  export const FontAwesome: React.ComponentType<IconProps>;
  export const MaterialIcons: React.ComponentType<IconProps>;
  export const Feather: React.ComponentType<IconProps>;
}
