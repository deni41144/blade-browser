// USER sheets are process-wide, so ownership must also be process-wide.
// A second browser window must not leave its old wallpaper/theme registered.
export const themeState = {
  themeURI: null, themeSignature: '',
  bgURI: null, bgSignature: '', bgRequest: 0,
};
