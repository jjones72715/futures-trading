// Approximate hex values for Airtable's singleSelect color palette, keyed by
// the color name Airtable returns from its field-choices metadata.
export const AIRTABLE_COLOR_HEX = {
  blueLight2: '#cfdfff', blueLight1: '#9cc7ff', blueBright: '#2d7ff9', blueDark1: '#0b5fff',
  cyanLight2: '#d0f0fd', cyanLight1: '#7ceafc', cyanBright: '#18bfff', cyanDark1: '#0a9bcf',
  tealLight2: '#bdf3f0', tealLight1: '#66e5dc', tealBright: '#20d9d2', tealDark1: '#068a81',
  greenLight2: '#d1f7c4', greenLight1: '#a1e9a1', greenBright: '#20c933', greenDark1: '#0f7b35',
  yellowLight2: '#ffeab6', yellowLight1: '#ffdc7a', yellowBright: '#fcb400', yellowDark1: '#c98c00',
  orangeLight2: '#fee2d5', orangeLight1: '#fdc999', orangeBright: '#ff6f2c', orangeDark1: '#cc5200',
  redLight2: '#ffdce5', redLight1: '#ffa9bd', redBright: '#f82b60', redDark1: '#c41c48',
  pinkLight2: '#ffdaf6', pinkLight1: '#faa8e5', pinkBright: '#ff08c2', pinkDark1: '#c4038f',
  purpleLight2: '#eee0fd', purpleLight1: '#d1b0f0', purpleBright: '#8b46ff', purpleDark1: '#6b1fd9',
  grayLight2: '#eeeeee', grayLight1: '#cccccc', grayBright: '#666666', grayDark1: '#1d1f25',
};

const FALLBACK_COLORS = [
  '#00D4FF', '#FFD700', '#FF6B6B', '#4ECDC4', '#A78BFA',
  '#F97316', '#34D399', '#FB7185', '#60A5FA', '#FBBF24',
];

export function resolveProgramColor(programName, colorNameByProgram, fallbackIndex) {
  const colorName = colorNameByProgram?.[programName];
  if (colorName && AIRTABLE_COLOR_HEX[colorName]) return AIRTABLE_COLOR_HEX[colorName];
  return FALLBACK_COLORS[fallbackIndex % FALLBACK_COLORS.length];
}
