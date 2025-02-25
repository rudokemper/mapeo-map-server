import path from 'path'

import { StyleJSON } from './stylejson'

const SPACES_REGEX = / /g
export const DEFAULT_STATIC_FONT = 'Open Sans Regular'
export const SDF_STATIC_DIR = path.resolve(__dirname, '../../sdf')

// Returns an array of values where each value is a comma-separated string of font names
// Adapted version of https://github.com/digidem/mapbox-style-downloader/blob/695ed8a981efb9f0ece80cba8c81d075f9a0cdda/lib/glyphs.js#L21-L53
export function getFontStacks(style: StyleJSON): string[] {
  const fontStacks = new Set<string>()

  style.layers.forEach((layer) => {
    if (
      layer.layout &&
      'text-font' in layer.layout &&
      layer.layout['text-font']
    ) {
      const textFontValue = layer.layout['text-font']
      if (Array.isArray(textFontValue)) {
        if (
          textFontValue[0] === 'step' &&
          textFontValue[2] &&
          Array.isArray(textFontValue[2]) &&
          textFontValue[2][0] === 'literal'
        ) {
          if (Array.isArray(textFontValue[2][1])) {
            fontStacks.add(textFontValue[2][1].join(','))
          } else if (typeof textFontValue[2][1] === 'string') {
            fontStacks.add(textFontValue[2][1])
          }
        } else if (textFontValue[0] === 'literal') {
          if (Array.isArray(textFontValue[1])) {
            fontStacks.add(textFontValue[1].join(','))
          } else if (typeof textFontValue[1] === 'string') {
            fontStacks.add(textFontValue[1])
          }
        } else {
          fontStacks.add(textFontValue.join(','))
        }
      } else if (typeof textFontValue === 'string') {
        fontStacks.add(textFontValue)
      } else if ('stops' in textFontValue && textFontValue.stops) {
        textFontValue.stops.forEach((stop) => {
          const stack = Array.isArray(stop[1]) ? stop[1].join(',') : stop[1]
          fontStacks.add(stack)
        })
      }
    }
  })

  return [...fontStacks]
}

export function createStaticGlyphPath(
  font: string,
  start: number,
  end: number
) {
  // We replace the space character with a hyphen when saved in the filesystem
  const convertedFontName = font.replace(SPACES_REGEX, '-')
  return `${convertedFontName}/${start}-${end}.pbf`
}

const GLYPHS_RANGE_MULTIPLIER = 256
const GLYPHS_RANGE_START_MAX = 65280

// Based on start and end parameter docs here:
// https://docs.mapbox.com/api/maps/fonts/#retrieve-font-glyph-ranges
export function isValidGlyphsRange(start: number, end: number) {
  if (start < 0 || end < 0) return false

  const validStart =
    start % GLYPHS_RANGE_MULTIPLIER === 0 && start <= GLYPHS_RANGE_START_MAX
  const validEnd = end - start === GLYPHS_RANGE_MULTIPLIER - 1

  return validStart && validEnd
}
