import { useEffect } from 'react';

/**
 * Custom hook to dynamically calculate and update viewport scale custom CSS properties.
 * Continuously adjusts CSS variables (--vh, --vw, --app-scale, --fluid-rem, font-size) on window resize
 * and orientation change to ensure perfect pixel scaling on mobile, tablet, desktop, and 4K displays.
 */
export const useViewportScaler = () => {
  useEffect(() => {
    let ticking = false;

    const updateScale = () => {
      const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
      const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);

      // 1. Calculate mobile address bar safe height (1vh)
      const vhUnit = vh * 0.01;
      const vwUnit = vw * 0.01;
      document.documentElement.style.setProperty('--vh', `${vhUnit}px`);
      document.documentElement.style.setProperty('--vw', `${vwUnit}px`);

      // 2. Calculate dynamic app scaling factor normalized across device screen sizes
      let scaleFactor = 1;
      if (vw >= 1920) {
        scaleFactor = Math.min(vw / 1920, 1.25);
      } else if (vw >= 1280) {
        scaleFactor = Math.max(vw / 1440, 0.90);
      } else if (vw >= 768) {
        scaleFactor = Math.max(vw / 1024, 0.85);
      } else {
        // Mobile screens: Keep text readable without layout breakage
        scaleFactor = Math.max(vw / 414, 0.82);
      }

      document.documentElement.style.setProperty('--app-scale', scaleFactor.toFixed(3));

      // 3. Proportional root font-size scaling
      const computedRem = Math.min(Math.max(15 * scaleFactor, 13.5), 18);
      document.documentElement.style.setProperty('--fluid-rem', `${computedRem.toFixed(2)}px`);
      document.documentElement.style.fontSize = `${computedRem.toFixed(2)}px`;

      ticking = false;
    };

    const onResize = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateScale);
        ticking = true;
      }
    };

    // Initial scale calculation
    updateScale();

    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onResize, { passive: true });

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
};

