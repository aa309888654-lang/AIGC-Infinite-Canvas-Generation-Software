// 护眼模式相关的工具函数
export const applyEyeCareMode = (enable: boolean) => {
  if (enable) {
    document.documentElement.style.filter = 'sepia(0.3) contrast(1.05) brightness(0.98)';
    document.documentElement.style.setProperty('--text-primary', '#E8E8EB');
    document.documentElement.style.setProperty('--bg-primary', '#0d0d0d');
  } else {
    document.documentElement.style.filter = 'none';
    document.documentElement.style.setProperty('--text-primary', '#F0F0F3');
    document.documentElement.style.setProperty('--bg-primary', '#0A0A0B');
  }
};

export const getEyeCareMode = (): boolean => {
  return localStorage.getItem('eyeCareMode') === 'true';
};

export const setEyeCareMode = (enable: boolean) => {
  localStorage.setItem('eyeCareMode', String(enable));
  applyEyeCareMode(enable);
};

export const toggleEyeCareMode = () => {
  const current = getEyeCareMode();
  const newState = !current;
  setEyeCareMode(newState);
  return newState;
};
