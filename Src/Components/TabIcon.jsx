import React from 'react';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';

/**
 * TabIcon component - Strict implementation of the FocusFlow Navigation Contract v2.
 * Renders identical 24dp geometry with 2dp stroke width across both active and inactive states.
 * Colors change dynamically based on active status (#FFFFFF on active pill, #727A91 inactive).
 */
export default function TabIcon({ name, color = '#727A91', size = 24 }) {
    switch (name) {
        case 'Home':
            // 1. Home = outlined house with pitched roof, door, no fill
            return (
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                    <Path
                        d="M3 10.5L12 3.5L21 10.5V20.5C21 21.05 20.55 21.5 20 21.5H4C3.45 21.5 3 21.05 3 20.5V10.5Z"
                        stroke={color}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <Path
                        d="M9.5 21.5V13.5C9.5 13 10 12.5 10.5 12.5H13.5C14 12.5 14.5 13 14.5 13.5V21.5"
                        stroke={color}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </Svg>
            );

        case 'Usage':
            // 2. Usage = three vertical rounded bars, ascending left to right, equal bar widths
            return (
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                    <Rect x={3.5} y={13.5} width={4} height={7.5} rx={2} stroke={color} strokeWidth={2} />
                    <Rect x={10} y={8.5} width={4} height={12.5} rx={2} stroke={color} strokeWidth={2} />
                    <Rect x={16.5} y={3.5} width={4} height={17.5} rx={2} stroke={color} strokeWidth={2} />
                </Svg>
            );

        case 'Schedule':
            // 3. Schedule = outlined square calendar with exactly two binding tabs and horizontal divider, no dots
            return (
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                    <Rect x={3} y={5} width={18} height={16} rx={3} stroke={color} strokeWidth={2} />
                    <Line x1={3} y1={10.5} x2={21} y2={10.5} stroke={color} strokeWidth={2} />
                    <Line x1={7.5} y1={2.5} x2={7.5} y2={6.5} stroke={color} strokeWidth={2} strokeLinecap="round" />
                    <Line x1={16.5} y1={2.5} x2={16.5} y2={6.5} stroke={color} strokeWidth={2} strokeLinecap="round" />
                </Svg>
            );

        case 'Focus':
            // 4. Focus = outlined circular stopwatch with top button, short diagonal button at upper right, and one vertical hand
            return (
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                    <Circle cx={12} cy={14} r={7.5} stroke={color} strokeWidth={2} />
                    <Line x1={12} y1={3} x2={12} y2={6.5} stroke={color} strokeWidth={2} strokeLinecap="round" />
                    <Line x1={10} y1={3} x2={14} y2={3} stroke={color} strokeWidth={2} strokeLinecap="round" />
                    <Line x1={17.8} y1={7} x2={19.8} y2={5} stroke={color} strokeWidth={2} strokeLinecap="round" />
                    <Line x1={12} y1={14} x2={12} y2={10} stroke={color} strokeWidth={2} strokeLinecap="round" />
                </Svg>
            );

        case 'Reports':
            // 5. Reports = outlined portrait document with folded upper-right corner and three small ascending chart bars inside
            return (
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                    <Path
                        d="M5 4.5C5 3.4 5.9 2.5 7 2.5H14L19 7.5V19.5C19 20.6 18.1 21.5 17 21.5H7C5.9 21.5 5 20.6 5 19.5V4.5Z"
                        stroke={color}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <Path
                        d="M14 2.5V7.5H19"
                        stroke={color}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <Line x1={8.5} y1={17.5} x2={8.5} y2={15} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
                    <Line x1={12} y1={17.5} x2={12} y2={12.5} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
                    <Line x1={15.5} y1={17.5} x2={15.5} y2={10} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
                </Svg>
            );

        default:
            return null;
    }
}
