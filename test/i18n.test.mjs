import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import ts from 'typescript';
import { resolveLanguage, supportsLanguage } from '../src/odd-bureau/i18n.js';

const english = JSON.parse(readFileSync(new URL('../src/odd-bureau/messages.en.json', import.meta.url)));

test('system language and voice language tags resolve Chinese and English consistently', () => {
  for (const tag of ['zh', 'zh-CN', 'zh-TW', 'ZH_hans']) assert.equal(resolveLanguage(tag), 'zh');
  for (const tag of ['en', 'en-GB', 'fr-FR', 'ja', '', undefined]) assert.equal(resolveLanguage(tag), 'en');
  assert.equal(supportsLanguage(['zh-CN'], 'zh'), true);
  assert.equal(supportsLanguage(['en-US'], 'en'), true);
  assert.equal(supportsLanguage(['chinese', 'english'], 'zh'), true);
  assert.equal(supportsLanguage(['chinese', 'english'], 'en'), true);
  assert.equal(supportsLanguage(['chinese'], 'en'), false);
  assert.equal(supportsLanguage(['zh-CN'], 'en'), false);
  assert.equal(supportsLanguage(['fr-FR'], 'en'), false);
  assert.equal(supportsLanguage([], 'zh'), true);
});

test('every English message preserves its Chinese interpolation slots', () => {
  const slots = value => [...value.matchAll(/\{(\d+)\}/g)].map(m => m[1]).sort();
  for (const [zh, en] of Object.entries(english)) {
    assert.ok(en.trim(), zh);
    assert.deepEqual(slots(en), slots(zh), zh);
  }
});

// Render real components, with rule fixtures only for deterministic views.
// This is presentation/contract testing, not a claim of protected App acceptance.
const root = fileURLToPath(new URL('../', import.meta.url));
const artifactDirectory = join(root, '.nimi', 'local');
const output = join(artifactDirectory, 'i18n-test-view.mjs');
mkdirSync(artifactDirectory, { recursive: true });
await build({
  stdin: { contents: `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Playground } from './src/odd-bureau/Playground.tsx';
import { OddBureau } from './src/odd-bureau/App.tsx';
import { Setup } from './src/odd-bureau/Setup.tsx';
import { MachineGame } from './src/odd-bureau/MachineGame.tsx';
import { StrikeGame } from './src/odd-bureau/StrikeGame.tsx';
import { WorkbenchRuntimeGate } from './src/workbench-core/runtime-gate.tsx';
import { casePrompt, dialoguePrompt } from './src/odd-bureau/game.ts';
import { allowedOps, initialMachine, machinePrompt, strikePrompt, proposalPrompt, performancePrompt, parsePerformance } from './src/odd-bureau/play-rules.ts';
import { displayName, language, t, localizeCarrierMessage } from './src/odd-bureau/i18n.js';
const labels = language === 'zh' ? ['时钟', '书本', '灯', '杯子'] : ['Clock', 'Book', 'Lamp', 'Cup'];
const objects = labels.map((label,i)=>({id:'object-'+(i+1),label,box:{x1:i*.2,y1:.1,x2:i*.2+.1,y2:.3}}));
const photo={name:t('早餐之后'),source:'sample',url:'test-only.jpg',width:1000,height:700};
const machine={kind:'machine',plan:{title:'Fixture machine',invitation:'Fixture invitation',nodes:objects.map((p,i)=>({objectId:p.id,op:['source','echo','raise','store'][i],melody:i===0?[0,2]:[],line:'Fixture line'}))},state:initialMachine()};
const strike={kind:'strike',plan:{title:'Fixture strike',situation:'Fixture situation',people:objects.map((p,i)=>({objectId:p.id,persona:'Fixture persona',offers:[{task:['reading','story','stage','stage'][i],needsCredit:i===1,needsRest:i===0?objects[2].id:null}]}))},state:{promises:[],journal:[],performance:null,curtain:0}};
export function inspect() {
 const views={home:<Playground/>,mystery:<OddBureau/>,setup:<Setup onBack={()=>{}}/>,machine:<MachineGame photo={photo} objects={objects} round={machine} onChange={()=>{}}/>,strike:<StrikeGame photo={photo} objects={objects} round={strike} onChange={()=>{}} onRestart={()=>{}}/>,gate:<WorkbenchRuntimeGate appTitle="奇物局" copy={{checking:'Connecting to Nimi…'}} resolve={async()=>({status:'ready'})} clear={()=>{}} toErrorMessage={()=>''}><div/></WorkbenchRuntimeGate>};
 return {language,displayName,views:Object.fromEntries(Object.entries(views).map(([k,v])=>[k,renderToStaticMarkup(v)])),prompts:[casePrompt(objects,'missing'),machinePrompt(objects),strikePrompt(objects),proposalPrompt(strike.plan,objects,[],'Question'),performancePrompt(objects),dialoguePrompt({mystery:{incident:'Fixture incident'},messages:{}},{name:labels[0],persona:'Fixture persona',testimony:'Fixture testimony'},'Question')],ops:objects.map(p=>allowedOps(p.label)),carrier:localizeCarrierMessage('This App needs Nimi')};
}
export {parsePerformance};
`, resolveDir: root, loader: 'tsx' },
  outfile: output, bundle: true, platform: 'node', format: 'esm', packages: 'external',
  loader: { '.css': 'empty' }, logLevel: 'silent',
});

for (const [systemLanguage, expected] of [['en-US', 'en'], ['zh-CN', 'zh'], ['zh-TW', 'zh'], ['fr-FR', 'en']]) {
  test(`interface, names, and generation follow system ${systemLanguage}`, () => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
Object.defineProperty(globalThis, 'navigator', {value:{language:${JSON.stringify(systemLanguage)}}, configurable:true});
const {inspect,parsePerformance}=await import(${JSON.stringify(pathToFileURL(output).href)});
const result=inspect();
for(const forbidden of ['The strike began.', 'They gave him credit.', '她拿到了署名。']) {
 let rejected=false; try {parsePerformance({parts:[forbidden,'The cup went sailing.','It found a friend.']})} catch {rejected=true}
 if(!rejected)throw new Error('backstage arrangement accepted');
}
console.log(JSON.stringify(result));`], { encoding: 'utf8', cwd: root });
    assert.equal(result.status, 0, result.stderr);
    const data = JSON.parse(result.stdout);
    assert.equal(data.language, expected);
    assert.equal(data.displayName, expected === 'zh' ? '奇物局' : 'Odd Bureau');
    assert.deepEqual(data.ops, [['source'], ['echo', 'reverse', 'source'], ['raise', 'reverse', 'source'], ['store']]);
    for (const prompt of data.prompts) assert.ok(prompt.includes(expected === 'zh' ? 'Simplified Chinese' : 'English'));
    for (const [view, html] of Object.entries(data.views)) {
      assert.ok(!html.includes('undefined'), view);
      if (expected === 'en') assert.ok(!/[\u3400-\u9fff]/.test(html.replaceAll('奇物局', '')), `${view}: unexpected Chinese`);
    }
    assert.ok(data.views.home.includes(expected === 'zh' ? '让日常' : 'Let everyday life'));
    assert.ok(data.views.setup.includes(expected === 'zh' ? '给游乐场接通 AI' : 'Connect the playground to AI'));
    assert.equal(data.carrier, expected === 'zh' ? '此 App 需要连接 Nimi' : 'This App needs Nimi');
    writeFileSync(join(artifactDirectory, `i18n-${systemLanguage}.json`), JSON.stringify(data, null, 2));
  });
}

test('all product message calls are present in the English catalog', () => {
  for (const name of ['App.tsx','Playground.tsx','Setup.tsx','PhotoStage.tsx','MachineGame.tsx','StrikeGame.tsx','game.ts','play-rules.ts','play-runtime.ts','nimi.ts','tone-player.ts']) {
    const path=join(root, 'src', 'odd-bureau', name);
    const source=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true);
    const visit=node=>{
      if(ts.isCallExpression(node)&&node.expression.getText(source)==='t') {
        const key=node.arguments[0]; assert.ok(ts.isStringLiteral(key));
        assert.ok(Object.hasOwn(english,key.text),`${name}: ${key.text}`);
      }
      ts.forEachChild(node,visit);
    };
    visit(source);
  }
});
