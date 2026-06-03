const forbiddenNames = [
  ['local', 'Storage'].join(''),
  ['session', 'Storage'].join(''),
  ['Authorization', ':', ' Bearer'].join(''),
];

export function assertNoBrowserTokenPersistence(sourceText) {
  return forbiddenNames.every((name) => !sourceText.includes(name));
}
