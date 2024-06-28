import { Cenotaph, RunestoneSpec } from "../rune";
import { DigitalArtifact } from "./digital-artifact";

export interface ParsedRunestone extends DigitalArtifact {

  runestone: RunestoneSpec | null;
  cenotaph: Cenotaph | null;
}
