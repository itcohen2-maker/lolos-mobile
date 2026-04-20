import type { MsgParams } from './i18n';

export type BotNarrationInput =
  | { kind: 'beginTurn'; name: string }
  | { kind: 'rollDice'; name: string }
  | { kind: 'playIdentical'; name: string; card: string }
  | { kind: 'playFractionAttack'; x: string; y: string }
  | { kind: 'playFractionBlock'; name: string; card: string }
  | { kind: 'defendFractionSolveWild'; name: string; card: string; value: string; penalty: string }
  | { kind: 'defendFractionSolveNumber'; name: string; card: string; penalty: string }
  | { kind: 'defendFractionPenalty'; name: string; penalty: string }
  | { kind: 'confirmEquation'; name: string; equation: string; target: string; jokerOp?: string; operationLabel?: string }
  | { kind: 'stageNumber'; name: string; card: string }
  | { kind: 'stageWild'; name: string; card: string }
  | { kind: 'stageOperation'; name: string; card: string }
  | { kind: 'stageCard'; name: string; card: string }
  | { kind: 'confirmStaged'; name: string }
  | { kind: 'drawCard'; name: string }
  | { kind: 'noSolution'; name: string }
  | { kind: 'endTurn'; name: string };

export type BotNarrationRendered = {
  message: string;
  body: string;
  style: 'info' | 'warning' | 'success';
  emoji: string;
  autoDismissMs: number;
};

type TranslateFn = (key: string, params?: MsgParams) => string;

export function renderBotNarration(tf: TranslateFn, input: BotNarrationInput): BotNarrationRendered {
  switch (input.kind) {
    case 'beginTurn':
      return { message: tf('botOffline.explain.beginTurn', { name: input.name }), body: '', style: 'info', emoji: '🤖', autoDismissMs: 3800 };
    case 'rollDice':
      return { message: tf('botOffline.explain.rollDice', { name: input.name }), body: '', style: 'info', emoji: '🤖', autoDismissMs: 3800 };
    case 'playIdentical':
      return { message: tf('botOffline.explain.playIdenticalCard', { name: input.name, card: input.card }), body: '', style: 'info', emoji: '🤖', autoDismissMs: 3800 };
    case 'playFractionAttack':
      return {
        message: tf('botOffline.fractionAttackChallenged'),
        body: tf('botOffline.fractionAttackExplain', { x: input.x, y: input.y }),
        style: 'warning',
        emoji: '⚔️',
        autoDismissMs: 5200,
      };
    case 'playFractionBlock':
      return { message: tf('botOffline.explain.fractionBlock', { name: input.name, card: input.card }), body: '', style: 'warning', emoji: '🛡️', autoDismissMs: 3800 };
    case 'defendFractionSolveWild':
      return {
        message: tf('botOffline.explain.defendWild', {
          name: input.name,
          card: input.card,
          value: input.value,
          penalty: input.penalty,
        }),
        body: '',
        style: 'info',
        emoji: '🤖',
        autoDismissMs: 3800,
      };
    case 'defendFractionSolveNumber':
      return {
        message: tf('botOffline.explain.defendNumber', {
          name: input.name,
          card: input.card,
          penalty: input.penalty,
        }),
        body: '',
        style: 'info',
        emoji: '🤖',
        autoDismissMs: 3800,
      };
    case 'defendFractionPenalty':
      return { message: tf('botOffline.explain.defendPenalty', { name: input.name, penalty: input.penalty }), body: '', style: 'warning', emoji: '⚠️', autoDismissMs: 3800 };
    case 'confirmEquation':
      return {
        message: tf('botOffline.explain.confirmEquation', {
          name: input.name,
          equation: input.equation,
          target: input.target,
        }),
        body: input.jokerOp != null
          ? tf('botOffline.explain.confirmEquationJoker', { name: input.name, op: input.jokerOp })
          : input.operationLabel != null
            ? tf('botOffline.explain.confirmEquationOperation', { name: input.name, op: input.operationLabel })
            : '',
        style: 'success',
        emoji: '🧠',
        autoDismissMs: 5200,
      };
    case 'stageNumber':
      return { message: tf('botOffline.explain.stageNumber', { name: input.name, card: input.card }), body: '', style: 'info', emoji: '🤖', autoDismissMs: 3800 };
    case 'stageWild':
      return { message: tf('botOffline.explain.stageWild', { name: input.name, card: input.card }), body: '', style: 'info', emoji: '🤖', autoDismissMs: 3800 };
    case 'stageOperation':
      return { message: tf('botOffline.explain.stageOperation', { name: input.name, card: input.card }), body: '', style: 'info', emoji: '🤖', autoDismissMs: 3800 };
    case 'stageCard':
      return { message: tf('botOffline.explain.stageCard', { name: input.name, card: input.card }), body: '', style: 'info', emoji: '🤖', autoDismissMs: 3800 };
    case 'confirmStaged':
      return { message: tf('botOffline.explain.confirmStaged', { name: input.name }), body: '', style: 'info', emoji: '🤖', autoDismissMs: 3800 };
    case 'drawCard':
      return { message: tf('botOffline.explain.drawCard', { name: input.name }), body: '', style: 'info', emoji: '🤖', autoDismissMs: 3800 };
    case 'noSolution':
      return { message: tf('botOffline.explain.noSolution', { name: input.name }), body: '', style: 'warning', emoji: '🤷', autoDismissMs: 2200 };
    case 'endTurn':
      return { message: tf('botOffline.explain.endTurn', { name: input.name }), body: '', style: 'info', emoji: '🤖', autoDismissMs: 3800 };
    default: {
      const _exhaustive: never = input;
      return _exhaustive;
    }
  }
}

export function botNarrationToastText(rendered: BotNarrationRendered): string {
  return rendered.body ? `${rendered.message}\n${rendered.body}` : rendered.message;
}
