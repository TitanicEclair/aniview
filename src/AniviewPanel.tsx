import * as React from 'react';
import { View, ViewStyle } from 'react-native';
import Aniview from './Aniview';
import { AniviewProps, AniviewFrame } from './useAniviewContext';

const DEFAULT_LAYOUT = {
  CONTENT_BG: '#FFFFFF',
  FRAME_INK: '#2D2D2D',
  FRAME_WOOD: '#C19A6B',
  BORR: 8,
  FRAME_WIDTH: 2,
  OUTLINE_WIDTH: 1,
  GUTTER_H: 16
};

/**
 * PANEL FRAME (Visual Only)
 */
interface PanelFrameProps {
  width?: number | string;
  height?: number | string;
  backgroundColor?: string;
  children?: React.ReactNode;
  style?: ViewStyle;
  clipContent?: boolean;
}

export const PanelFrame = ({
  width,
  height,
  backgroundColor = DEFAULT_LAYOUT.CONTENT_BG,
  children,
  style,
  clipContent = true
}: PanelFrameProps) => {

  const frameWidth = DEFAULT_LAYOUT.FRAME_WIDTH;
  const inkWidth = DEFAULT_LAYOUT.OUTLINE_WIDTH;

  return (
    <View
      style={{
        width: width as any,
        height: height as any,
        borderWidth: inkWidth,
        borderColor: DEFAULT_LAYOUT.FRAME_INK,
        borderRadius: DEFAULT_LAYOUT.BORR,
        backgroundColor: 'transparent',
        overflow: clipContent ? 'hidden' : 'visible',
        ...style
      }}
    >
      <View 
        style={{
          flex: 1,
          borderWidth: frameWidth,
          borderColor: DEFAULT_LAYOUT.FRAME_WOOD,
          backgroundColor: 'transparent',
          overflow: clipContent ? 'hidden' : 'visible'
        }}
      >
        <View 
          style={{
            flex: 1,
            backgroundColor: 'transparent',
            borderWidth: inkWidth,
            borderColor: DEFAULT_LAYOUT.FRAME_INK,
            borderRadius: Math.max(0, DEFAULT_LAYOUT.BORR - frameWidth - inkWidth),
            overflow: clipContent ? 'hidden' : 'visible'
          }}
        >
          {children}
        </View>
      </View>
    </View>
  );
};

/**
 * ANIVIEW PANEL (Animated component)
 */
export interface AniviewPanelProps extends AniviewProps {
  pageId: number | string;
  width: number;
  height: number;
  marginTop?: number;
  marginLeft?: number;
  backgroundColor?: string;
  frames?: Record<string, AniviewFrame> | AniviewFrame[];
  style?: ViewStyle;
  children?: React.ReactNode;
  clipContent?: boolean;
}

export const AniviewPanel = (props: AniviewPanelProps) => {
  const {
    pageId,
    width,
    height,
    marginTop = 0,
    marginLeft = 0,
    backgroundColor,
    frames,
    children,
    style,
    clipContent = true,
    ...rest
  } = props;

  const hasExternalBg = !!(style as any)?.backgroundColor || 
    (frames && (Array.isArray(frames) 
      ? frames.some(f => (f.style as any)?.backgroundColor) 
      : Object.values(frames).some(f => (f.style as any)?.backgroundColor)));
  
  const innerBg = hasExternalBg ? 'transparent' : (backgroundColor || 'transparent');

  return (
    <Aniview
      pageId={pageId}
      frames={frames as any}
      style={{
        width,
        height,
        marginTop,
        marginLeft,
        backgroundColor: backgroundColor || (style as any)?.backgroundColor,
        ...(style as any)
      }}
      {...rest}
    >
      <PanelFrame
        width="100%"
        height="100%"
        backgroundColor={innerBg}
        clipContent={clipContent}
      >
        {children as React.ReactNode}
      </PanelFrame>
    </Aniview>
  );
};
