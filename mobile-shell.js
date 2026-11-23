// Parser-blocking startup gate: runs before the game or its loading artwork is painted.
(() => {
 const root=document.documentElement;
 function update(){
  const mobile=matchMedia('(pointer:coarse)').matches||/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const width=visualViewport?.width||innerWidth,height=visualViewport?.height||innerHeight;
  root.classList.toggle('touch-device',mobile);
  root.classList.toggle('portrait-gate',mobile&&innerHeight>innerWidth);
  root.style.setProperty('--view-width',width+'px');root.style.setProperty('--view-height',height+'px');
 }
 update();addEventListener('resize',update);addEventListener('orientationchange',update);visualViewport?.addEventListener('resize',update);
})();
