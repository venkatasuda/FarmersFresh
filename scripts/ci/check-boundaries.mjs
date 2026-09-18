import ts from "typescript";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
const root=process.cwd(), graph=new Map(), clientRoots=[];
function walk(directory) {
  return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(resolve(directory,entry.name)):/\.[cm]?[jt]sx?$/.test(entry.name)?[resolve(directory,entry.name)]:[]);
}
for (const file of [...walk(resolve('app')),...walk(resolve('lib'))]) {
  const source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
  const directive=source.statements[0];
  const mode=directive && ts.isExpressionStatement(directive) && ts.isStringLiteral(directive.expression)?directive.expression.text:'';
  const imports=[];
  function visit(node) {
    if ((ts.isImportDeclaration(node)||ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const typeOnly=ts.isImportDeclaration(node)
        ? node.importClause?.isTypeOnly || (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && !node.importClause.name && node.importClause.namedBindings.elements.every(element=>element.isTypeOnly))
        : node.isTypeOnly;
      if(!typeOnly)imports.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node) && node.expression.kind===ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) imports.push(node.arguments[0].text);
    ts.forEachChild(node,visit);
  }
  visit(source); graph.set(file,{mode,imports});if(mode==='use client')clientRoots.push(file);
}
function target(file,specifier) {
  const base=specifier.startsWith('@/')?resolve(root,specifier.slice(2)):specifier.startsWith('.')?resolve(dirname(file),specifier):null;
  if (!base) return null;
  return [base,...['.ts','.tsx','.js','.jsx','/index.ts','/index.tsx'].map(suffix=>base+suffix)].find(path=>existsSync(path)&&graph.has(path));
}
const errors=[];
function trace(file,path,seen,pure=false) {
  if(seen.has(file))return;seen.add(file);
  const item=graph.get(file);if(!item)return;
  // Next intentionally converts exports of a 'use server' module to action proxies.
  if(item.mode==='use server' && path.length>1 && !pure)return;
  for(const specifier of item.imports) {
    if(specifier==='next/headers'||specifier==='server-only'||specifier.startsWith('node:')||(pure&&specifier.includes('supabase'))) {
      errors.push(path.map(p=>relative(root,p)).join(' -> ')+' -> '+specifier);continue;
    }
    const next=target(file,specifier);if(next)trace(next,[...path,next],seen,pure);
  }
}
for(const file of clientRoots)trace(file,[file],new Set());
for(const file of ['lib/format.ts','lib/types.ts'])trace(resolve(file),[resolve(file)],new Set(),true);
if(errors.length){console.error('Server/client boundary violations:\n'+errors.join('\n'));process.exit(1);}
console.log(`Checked ${clientRoots.length} client entry points and shared formatting/type modules.`);
