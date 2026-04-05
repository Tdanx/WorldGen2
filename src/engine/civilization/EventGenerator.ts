import type { Civilization } from '../../types/civilization';
import type { ChronicleEntry } from '../../types/events';
import type { WarState, WarOutcome } from '../../types/conflict';
import type { DiplomaticPact } from '../../types/diplomacy';
import type { GodCommand } from '../../types/simulation';

export function makeCivFoundedEntry(
  civ: Civilization,
  tick: number,
  id: string,
): ChronicleEntry {
  return {
    id,
    tick,
    severity: 'major',
    eventType: 'civ_founded',
    civIds: [civ.id],
    description: `The ${civ.name} was founded in the ${civ.era} Age.`,
    location: civ.capitalTile,
  };
}

export function makeFamineEntry(
  civ: Civilization,
  tick: number,
  id: string,
): ChronicleEntry {
  return {
    id,
    tick,
    severity: 'minor',
    eventType: 'famine',
    civIds: [civ.id],
    description: `Famine grips the ${civ.name}.`,
    location: civ.capitalTile,
  };
}

export function makeEraBegunEntry(
  civ: Civilization,
  tick: number,
  id: string,
): ChronicleEntry {
  return {
    id,
    tick,
    severity: 'epoch',
    eventType: 'golden_age_begun',
    civIds: [civ.id],
    description: `The ${civ.name} enters the ${civ.era} Age.`,
  };
}

export function makeWarDeclaredEntry(
  war: WarState,
  aggressorName: string,
  defenderName: string,
  tick: number,
  id: string,
): ChronicleEntry {
  const isHoly = war.cause === 'holy_war';
  return {
    id,
    tick,
    severity: 'major',
    eventType: isHoly ? 'holy_war_declared' : 'war_declared',
    civIds: [war.aggressorId, war.defenderId],
    description: isHoly
      ? `${aggressorName} declares a holy war against ${defenderName}.`
      : `${aggressorName} declares war on ${defenderName}.`,
  };
}

export function makeWarEndedEntry(
  war: WarState,
  outcome: WarOutcome,
  tick: number,
  id: string,
): ChronicleEntry {
  const outcomeText: Record<WarOutcome, string> = {
    white_peace: 'The war ends in a stalemate.',
    aggressor_wins: 'The attacker claims victory.',
    defender_wins: 'The defender repels the invasion.',
    vassalage: 'The defeated nation is forced into vassalage.',
    annihilation: 'The defeated civilization is annihilated.',
  };
  return {
    id,
    tick,
    severity: 'major',
    eventType: 'war_ended',
    civIds: [war.aggressorId, war.defenderId],
    description: outcomeText[outcome],
    data: { outcome },
  };
}

export function makeTreatyEntry(
  pact: DiplomaticPact,
  civAName: string,
  civBName: string,
  tick: number,
  id: string,
): ChronicleEntry {
  return {
    id,
    tick,
    severity: 'minor',
    eventType: pact.violated ? 'treaty_violated' : 'treaty_formed',
    civIds: [pact.civA, pact.civB],
    description: pact.violated
      ? `${pact.violatedBy === pact.civA ? civAName : civBName} violates the ${pact.typeOf.replace(/_/g, ' ')} with ${pact.violatedBy === pact.civA ? civBName : civAName}.`
      : `${civAName} and ${civBName} form a ${pact.typeOf.replace(/_/g, ' ')}.`,
  };
}

export function makeHolyWarEntry(
  war: WarState,
  faithName: string,
  tick: number,
  id: string,
): ChronicleEntry {
  return {
    id,
    tick,
    severity: 'major',
    eventType: 'holy_war_declared',
    civIds: [war.aggressorId, war.defenderId],
    description: `A holy war erupts in the name of ${faithName}.`,
    data: { faithName },
  };
}

export function makeDivineInterventionEntry(
  cmd: GodCommand,
  tick: number,
  id: string,
): ChronicleEntry {
  const descriptions: Partial<Record<GodCommand['type'], string>> = {
    RAISE_TERRAIN: 'The gods raise the land.',
    LOWER_TERRAIN: 'The gods sink the earth.',
    SET_BIOME: 'The gods transform the landscape.',
    VOLCANIC_ERUPTION: 'The gods unleash a volcanic eruption.',
    METEOR_IMPACT: 'The gods hurl a meteor from the heavens.',
    FLOOD: 'The gods send a great flood.',
    DROUGHT: 'The gods curse the land with drought.',
    PLAGUE: 'The gods send a plague upon the people.',
    FORCE_WAR: 'The gods stoke the fires of war.',
    DIVINE_BLESSING: 'The gods bestow a divine blessing.',
    SPAWN_CIVILIZATION: 'The gods breathe life into a new people.',
  };
  return {
    id,
    tick,
    severity: 'epoch',
    eventType: 'divine_intervention',
    civIds: [],
    description: descriptions[cmd.type] ?? 'The gods intervene.',
    data: { commandType: cmd.type },
  };
}
