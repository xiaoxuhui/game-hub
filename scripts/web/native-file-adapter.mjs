import ts from 'typescript';
const routes={
  conway:[['scripts/dialogs.js',2],['scripts/record-import.js',1],['scripts/app.js',1]],
  light:[['scripts/app.js',1]],turing:[[/^assets\/main-[A-Za-z0-9_-]+\.js$/,1]],
  'abelian-sandpile':[['src/app.js',1]],'lambda-diagram-game':[['hub-inline-lambda-lab-html-7.js',1]],
  'mini-scratch':[['src/app.js',1]],eml:[['hub-inline-eml-workbench-html-0-ui.js',1]],'red-green-puzzle':[]
};
export function guardNativeFileReads(id,entries){
  const planned=routes[id];if(!planned)throw Error('Missing native import route');const output=entries.map(file=>({...file}));
  for(const [path,count] of planned){
    const candidates=output.filter(file=>typeof path==='string'?file.path===path:path.test(file.path));if(candidates.length!==1)throw Error('Unreviewed native import file layout');
    const file=candidates[0],text=file.data.toString('utf8'),ast=ts.createSourceFile(file.path,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),changes=[];
    if(ast.parseDiagnostics.length||text.includes('GameHubReadNativeFile'))throw Error('Unreviewed native import source');
    function visit(node){
      if(id==='eml'&&ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='readAsText'){
        const receiver=node.expression.expression.getText(ast),input=node.arguments[0]?.getText(ast);if(receiver!=='reader'||input!=='file'||node.arguments.length!==2)throw Error('Unreviewed EML file reader');
        changes.push({start:node.getStart(ast),end:node.end,text:`globalThis.GameHubReadNativeFile(file).then(text=>reader.readAsText(new Blob([text]),"utf-8"),()=>reader.onerror?.(new Event("error")))`});
      }else if(id!=='eml'&&ts.isAwaitExpression(node)&&ts.isCallExpression(node.expression)&&ts.isPropertyAccessExpression(node.expression.expression)&&node.expression.expression.name.text==='text'&&node.expression.arguments.length===0){
        const receiver=node.expression.expression.expression;if(!ts.isIdentifier(receiver))throw Error('Unreviewed native file expression');changes.push({start:node.getStart(ast),end:node.end,text:`await globalThis.GameHubReadNativeFile(${receiver.getText(ast)})`});
      }
      ts.forEachChild(node,visit);
    }
    visit(ast);if(changes.length!==count)throw Error('Unreviewed native import call count');let adapted=text;
    for(const change of changes.sort((a,b)=>b.start-a.start))adapted=adapted.slice(0,change.start)+change.text+adapted.slice(change.end);
    file.data=Buffer.from(id==='turing'?preserveTuringMetadata(adapted):adapted);
  }
  return output;
}
function preserveTuringMetadata(text){
  const ast=ts.createSourceFile('turing-ui.js',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),changes=[];let builders=0;
  function visit(node){
    if(ts.isObjectLiteralExpression(node)){
      const fields=new Map(node.properties.filter(ts.isPropertyAssignment).map(property=>[property.name.getText(ast),property]));
      if(fields.get('format')?.initializer.getText(ast)==='"turing-machine-simulator"'&&fields.has('name')&&fields.has('description')){
        if(node.properties.length!==14||!['name','description'].every(key=>ts.isStringLiteral(fields.get(key).initializer)))throw Error('Unreviewed Turing metadata builder');builders++;
        for(const key of ['name','description']){const value=fields.get(key).initializer;changes.push({start:value.getStart(ast),end:value.end,text:`globalThis.GameHubTuringProjectField("${key}",${value.getText(ast)})`});}
      }
    }
    ts.forEachChild(node,visit);
  }
  visit(ast);if(builders!==1)throw Error('Unreviewed Turing project builder count');let output=text;for(const change of changes.sort((a,b)=>b.start-a.start))output=output.slice(0,change.start)+change.text+output.slice(change.end);return output;
}
