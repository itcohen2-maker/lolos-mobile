import React from 'react'
import { Card as CardType } from '../../types/game'
import NumberCard from './NumberCard'
import FractionCard from './FractionCard'
import OperationCard from './OperationCard'
import JokerCard from './JokerCard'

interface Props {
  card: CardType
  selected?: boolean
  onPress?: () => void
  small?: boolean
}

export default function GameCard({ card, selected, onPress, small }: Props) {
  switch (card.type) {
    case 'number':
      return <NumberCard card={card} selected={selected} onPress={onPress} small={small} />
    case 'fraction':
      return <FractionCard card={card} selected={selected} onPress={onPress} small={small} />
    case 'operation':
      return <OperationCard card={card} selected={selected} onPress={onPress} small={small} />
    case 'joker':
      return <JokerCard card={card} selected={selected} onPress={onPress} small={small} />
  }
}
