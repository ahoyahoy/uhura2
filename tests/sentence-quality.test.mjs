import assert from "node:assert/strict";
import test from "node:test";
import { batchQualityIssues, filterSentencePairs, parseSentencePairs } from "../lib/sentence-quality.ts";

const variedA2 = {
  goalKind: "grammar",
  practiceStyle: "varied",
  level: "A2",
  targetLanguage: "en",
};

test("rejects a batch that repeats the present-versus-past compound frame", () => {
  const repetitive = [
    ["Každý den chodím do práce pěšky, ale včera jsem jel autobusem.", "I walk to work every day, but I took the bus yesterday."],
    ["Ona obvykle pije čaj, ale dnes ráno pila kávu.", "She usually drinks tea, but she drank coffee this morning."],
    ["Nechodíme často do kina, ale minulý měsíc jsme tam byli dvakrát.", "We don't go to the cinema often, but we went twice last month."],
    ["V kolik obvykle vstáváš? A v kolik jsi vstal dnes?", "What time do you usually get up? And what time did you get up today?"],
    ["Můj bratr pracuje doma, ale minulý týden pracoval v kanceláři.", "My brother works from home, but he worked in the office last week."],
    ["Autobus odjíždí v osm, ale včera odjel pozdě.", "The bus leaves at eight, but it left late yesterday."],
    ["Normálně nevařím v neděli, ale minulou neděli jsem uvařil večeři.", "I don't usually cook on Sundays, but I cooked dinner last Sunday."],
    ["Hraje tvoje sestra tenis každý týden? Hrála minulý víkend?", "Does your sister play tennis every week? Did she play last weekend?"],
    ["Tenhle obchod zavírá v šest, ale včera zavřel dřív.", "This shop closes at six, but it closed early yesterday."],
    ["Každé ráno čtu zprávy, ale včera jsem na to neměl čas.", "I read the news every morning, but I didn't have time yesterday."],
  ].map(([source, target]) => ({ source, target }));
  assert.ok(batchQualityIssues(repetitive, variedA2).some((issue) => issue.includes("multiple clauses")));
  assert.throws(() => filterSentencePairs(repetitive, [], variedA2), /not provide enough short, varied sentences/);
});

test("accepts short A2 grammar practice with distinct uses and sentence forms", () => {
  const varied = [
    ["Každé ráno vstávám v sedm.", "I get up at seven every morning."],
    ["V neděli jsme šli do zoo.", "On Sunday, we went to the zoo."],
    ["Má tvoje sestra ráda čaj?", "Does your sister like tea?"],
    ["Včera jsme Annu neviděli.", "We didn't see Anna yesterday."],
    ["Autobus odjíždí v osm.", "The bus leaves at eight."],
    ["Kde koupili ten dort?", "Where did they buy that cake?"],
    ["Moji přátelé hrají po škole fotbal.", "My friends play football after school."],
    ["Včera celý den pršelo.", "It rained all day yesterday."],
    ["Nejím maso.", "I don't eat meat."],
    ["Volali jste včera večer mamince?", "Did you call your mother last night?"],
  ].map(([source, target]) => ({ source, target }));
  assert.deepEqual(batchQualityIssues(varied, variedA2), []);
  assert.equal(filterSentencePairs(varied, [], variedA2).length, 10);
});

test("keeps candidate proposals for review, while final filtering rejects a repeat of an existing sentence", () => {
  const existing = [{ source: "Nejím maso.", target: "I don't eat meat." }];
  const candidates = [existing[0], { source: "Autobus odjíždí v osm.", target: "The bus leaves at eight." }];
  assert.equal(parseSentencePairs(candidates).length, 2);
  assert.deepEqual(filterSentencePairs(candidates, existing, variedA2), [candidates[1]]);
});

test("allows intentionally controlled repetition in fixed practice", () => {
  const fixedA2 = { ...variedA2, practiceStyle: "fixed" };
  const candidates = [
    ["zprávy", "the news"], ["knihu", "a book"], ["noviny", "the paper"],
    ["poznámky", "my notes"], ["jídelní lístek", "the menu"], ["dopis", "a letter"],
  ].map(([sourceObject, targetObject]) => ({
    source: `Každý den čtu ${sourceObject}.`, target: `I read ${targetObject} every day.`,
  }));
  assert.equal(filterSentencePairs(candidates, [], fixedA2).length, 6);
});
