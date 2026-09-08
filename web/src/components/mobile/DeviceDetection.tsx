import React from 'react';

interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouchDevice: boolean;
  deviceType: 'mobile' | 'tablet' | 'desktop';
}

function getDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined') {
    return { isMobile: false, isTablet: false, isDesktop: true, isTouchDevice: false, deviceType: 'desktop' };
  }

  const width = window.innerWidth;
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isTouchDevice = navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;

  return {
    isMobile,
    isTablet,
    isDesktop: !isMobile && !isTablet,
    isTouchDevice,
    deviceType: isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop',
  };
}

export function useDeviceDetection(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = React.useState<DeviceInfo>(getDeviceInfo);

  React.useEffect(() => {
    const updateDeviceInfo = () => setDeviceInfo(getDeviceInfo());
    window.addEventListener('resize', updateDeviceInfo);
    window.addEventListener('orientationchange', updateDeviceInfo);
    updateDeviceInfo();
    return () => {
      window.removeEventListener('resize', updateDeviceInfo);
      window.removeEventListener('orientationchange', updateDeviceInfo);
    };
  }, []);

  return deviceInfo;
}

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ResponsiveLayout({ children, fallback }: ResponsiveLayoutProps) {
  const deviceInfo = useDeviceDetection();
  void fallback;
  
  if (deviceInfo.isMobile && fallback) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export default useDeviceDetection;
