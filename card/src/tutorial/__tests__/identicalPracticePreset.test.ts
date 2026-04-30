import { buildIdenticalPracticePreset } from '../identicalPracticePreset'

describe('buildIdenticalPracticePreset', () => {
  test('builds fan options for multi-card tutorial practice', () => {
    const preset = buildIdenticalPracticePreset(7)
    const values = preset.fanCards.map((card) => card.value ?? -1)

    expect(preset.target).toBe(7)
    expect(preset.fanCards.length).toBeGreaterThanOrEqual(7)
    expect(values).toContain(0)
    expect(values).not.toContain(7)

    const combinationsOfTwoOrMore = values
      .map((first, firstIdx) =>
        values
          .slice(firstIdx + 1)
          .map((second) => first + second),
      )
      .flat()
    expect(combinationsOfTwoOrMore).toContain(7)
  })
})
