import { Flaw as FlawEnum } from './src/flaw';
import { RuneEtchingSpec } from './src/indexer';
import { Runestone, RunestoneTx } from './src/runestone';
import { SpacedRune } from './src/spacedrune';

export { Network } from './src/network';


export type RunestoneSpec = {
  mint?: {
    block: bigint;
    tx: number;
  };
  pointer?: number;
  etching?: RuneEtchingSpec;
  edicts?: {
    id: {
      block: bigint;
      tx: number;
    };
    amount: bigint;
    output: number;
  }[];
};

export type Flaw =
  | 'edict_output'
  | 'edict_rune_id'
  | 'invalid_script'
  | 'opcode'
  | 'supply_overflow'
  | 'trailing_integers'
  | 'truncated_field'
  | 'unrecognized_even_tag'
  | 'unrecognized_flag'
  | 'varint';

export type Cenotaph = {
  flaws: Flaw[];
  etching?: string;
  mint?: {
    block: bigint;
    tx: number;
  };
};

function getFlawString(flaw: FlawEnum): Flaw {
  switch (flaw) {
    case FlawEnum.EDICT_OUTPUT:
      return 'edict_output';
    case FlawEnum.EDICT_RUNE_ID:
      return 'edict_rune_id';
    case FlawEnum.INVALID_SCRIPT:
      return 'invalid_script';
    case FlawEnum.OPCODE:
      return 'opcode';
    case FlawEnum.SUPPLY_OVERFLOW:
      return 'supply_overflow';
    case FlawEnum.TRAILING_INTEGERS:
      return 'trailing_integers';
    case FlawEnum.TRUNCATED_FIELD:
      return 'truncated_field';
    case FlawEnum.UNRECOGNIZED_EVEN_TAG:
      return 'unrecognized_even_tag';
    case FlawEnum.UNRECOGNIZED_FLAG:
      return 'unrecognized_flag';
    case FlawEnum.VARINT:
      return 'varint';
  }
}

export function isRunestone(artifact: RunestoneSpec | Cenotaph): artifact is RunestoneSpec {
  return !('flaws' in artifact);
}

export function tryDecodeRunestone(tx: RunestoneTx): RunestoneSpec | Cenotaph | null {
  const optionArtifact = Runestone.decipher(tx);
  if (optionArtifact.isNone()) {
    return null;
  }

  const artifact = optionArtifact.unwrap();
  if (artifact.type === 'runestone') {
    const runestone = artifact;

    const etching = () => runestone.etching.unwrap();
    const terms = () => etching().terms.unwrap();

    return {
      ...(runestone.etching.isSome()
        ? {
            etching: {
              ...(etching().divisibility.isSome()
                ? { divisibility: etching().divisibility.map(Number).unwrap() }
                : {}),
              ...(etching().premine.isSome() ? { premine: etching().premine.unwrap() } : {}),
              ...(etching().rune.isSome()
                ? {
                    runeName: new SpacedRune(
                      etching().rune.unwrap(),
                      etching().spacers.map(Number).unwrapOr(0)
                    ).toString(),
                  }
                : {}),
              ...(etching().symbol.isSome() ? { symbol: etching().symbol.unwrap() } : {}),
              ...(etching().terms.isSome()
                ? {
                    terms: {
                      ...(terms().amount.isSome() ? { amount: terms().amount.unwrap() } : {}),
                      ...(terms().cap.isSome() ? { cap: terms().cap.unwrap() } : {}),
                      ...(terms().height.find((option) => option.isSome())
                        ? {
                            height: {
                              ...(terms().height[0].isSome()
                                ? { start: terms().height[0].unwrap() }
                                : {}),
                              ...(terms().height[1].isSome()
                                ? { end: terms().height[1].unwrap() }
                                : {}),
                            },
                          }
                        : {}),
                      ...(terms().offset.find((option) => option.isSome())
                        ? {
                            offset: {
                              ...(terms().offset[0].isSome()
                                ? { start: terms().offset[0].unwrap() }
                                : {}),
                              ...(terms().offset[1].isSome()
                                ? { end: terms().offset[1].unwrap() }
                                : {}),
                            },
                          }
                        : {}),
                    },
                  }
                : {}),
              turbo: etching().turbo,
            },
          }
        : {}),
      ...(runestone.mint.isSome()
        ? {
            mint: {
              block: runestone.mint.unwrap().block,
              tx: Number(runestone.mint.unwrap().tx),
            },
          }
        : {}),
      ...(runestone.pointer.isSome() ? { pointer: Number(runestone.pointer.unwrap()) } : {}),
      ...(runestone.edicts.length
        ? {
            edicts: runestone.edicts.map((edict) => ({
              id: {
                block: edict.id.block,
                tx: Number(edict.id.tx),
              },
              amount: edict.amount,
              output: Number(edict.output),
            })),
          }
        : {}),
    };
  } else {
    const cenotaph = artifact;
    return {
      flaws: cenotaph.flaws.map(getFlawString),
      ...(cenotaph.etching.isSome() ? { etching: cenotaph.etching.unwrap().toString() } : {}),
      ...(cenotaph.mint.isSome()
        ? { mint: { block: cenotaph.mint.unwrap().block, tx: Number(cenotaph.mint.unwrap().tx) } }
        : {}),
    };
  }
}
