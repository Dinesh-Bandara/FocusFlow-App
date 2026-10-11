import { Colors, darkColors } from './Colors';

export const Theme = {
    colors: Colors,
    spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
    },
    borderRadius: {
        sm: 4,
        md: 8,
        lg: 12,
        xl: 16,
        round: 9999,
    }
};

export const DarkTheme = {
    ...Theme,
    colors: darkColors,
};
