import type { SvgProps as DefaultSvgProps } from 'react-native-svg';
import type { IconProps as DefaultIconProps } from 'phosphor-react-native';

declare module 'react-native-svg' {
  interface SvgProps extends DefaultSvgProps {
    className?: string;
  }
}

declare module 'phosphor-react-native' {
  interface IconProps extends DefaultIconProps {
    className?: string;
  }
}
