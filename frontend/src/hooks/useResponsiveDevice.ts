import { useState, useEffect } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'pc';
export type OrientationType = 'portrait' | 'landscape';
export type AspectRatioType = '16:9' | '4:3' | '16:10' | '9:16' | '3:4';

export interface DeviceConfig {
  deviceType: DeviceType;
  orientation: OrientationType;
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isPC: boolean;
  isPortrait: boolean;
  isLandscape: boolean;
  aspectRatio: number; // width / height ratio
  suggestedRatio: AspectRatioType;
  aspectRatioClass: string; // Tailwind aspect class
  canvasWidth: number;
  canvasHeight: number;
  scaleFactor: number;
}

export const useResponsiveDevice = (): DeviceConfig => {
  const getDeviceConfig = (): DeviceConfig => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const h = typeof window !== 'undefined' ? window.innerHeight : 800;
    const ratio = w / h;
    const isPortrait = h > w;
    const orientation: OrientationType = isPortrait ? 'portrait' : 'landscape';

    // Touch device & screen width heuristics
    const hasTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    const isMobileWidth = w < 640 || (hasTouch && w < 768 && isPortrait);
    const isTabletWidth = !isMobileWidth && (w < 1024 || (hasTouch && w < 1200));

    let deviceType: DeviceType = 'pc';
    let suggestedRatio: AspectRatioType = '16:9';
    let aspectRatioClass = 'aspect-video';
    let canvasWidth = 1280;
    let canvasHeight = 720;
    let scaleFactor = 1.0;

    if (isMobileWidth) {
      deviceType = 'mobile';
      scaleFactor = 0.72;
      if (isPortrait) {
        // Vertical Portrait Phone Mode
        suggestedRatio = '3:4';
        aspectRatioClass = 'aspect-[3/4]';
        canvasWidth = 720;
        canvasHeight = 960;
      } else {
        // Horizontal Mobile Landscape Mode
        suggestedRatio = '4:3';
        aspectRatioClass = 'aspect-[4/3]';
        canvasWidth = 960;
        canvasHeight = 720;
      }
    } else if (isTabletWidth) {
      deviceType = 'tablet';
      scaleFactor = 0.86;
      if (isPortrait) {
        suggestedRatio = '4:3';
        aspectRatioClass = 'aspect-[4/3]';
        canvasWidth = 960;
        canvasHeight = 720;
      } else {
        suggestedRatio = '16:10';
        aspectRatioClass = 'aspect-[16/10]';
        canvasWidth = 1280;
        canvasHeight = 800;
      }
    } else {
      // PC / Widescreen Desktop Mode
      deviceType = 'pc';
      suggestedRatio = '16:9';
      aspectRatioClass = 'aspect-video';
      canvasWidth = 1280;
      canvasHeight = 720;
      scaleFactor = 1.0;
    }

    return {
      deviceType,
      orientation,
      width: w,
      height: h,
      isMobile: deviceType === 'mobile',
      isTablet: deviceType === 'tablet',
      isPC: deviceType === 'pc',
      isPortrait,
      isLandscape: !isPortrait,
      aspectRatio: ratio,
      suggestedRatio,
      aspectRatioClass,
      canvasWidth,
      canvasHeight,
      scaleFactor,
    };
  };

  const [deviceConfig, setDeviceConfig] = useState<DeviceConfig>(getDeviceConfig);

  useEffect(() => {
    const handleResize = () => {
      setDeviceConfig(getDeviceConfig());
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return deviceConfig;
};
