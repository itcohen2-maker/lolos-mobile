import React from 'react'
import { View } from 'react-native'
import Svg, { Rect, Text as SvgText } from 'react-native-svg'

const VB_W = 1200
const VB_H = 500

const HEBREW_MARK = '\u05E1\u05DC\u05D9\u05E0\u05D3\u05D4'

export type SalindaLogoOption06Props = {
  /** Total width; height follows 1200:500 aspect ratio */
  width?: number
}

export default function SalindaLogoOption06({ width: w = 280 }: SalindaLogoOption06Props) {
  const h = (w * VB_H) / VB_W
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Salinda">
      <Svg width={w} height={h} viewBox={`0 0 ${VB_W} ${VB_H}`}>
        <Rect width={VB_W} height={VB_H} rx={30} fill="#111827" />
        <Rect x={78} y={82} width={14} height={336} fill="#F59E0B" />
        <SvgText x={128} y={238} fill="#F59E0B" fontSize={118} fontWeight="900">
          Salinda
        </SvgText>
        <SvgText x={310} y={320} fill="#F8FAFC" fontSize={62} fontWeight="800">
          {HEBREW_MARK}
        </SvgText>
      </Svg>
    </View>
  )
}
