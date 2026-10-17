import ts from 'typescript';
export function guardAudioStart(id,entries){
  if(id!=='mini-scratch')return entries;
  const output=entries.map(file=>({...file})),matches=output.filter(file=>file.path==='src/audio.js');if(matches.length!==1)throw Error('Unreviewed Mini audio file layout');
  const file=matches[0],text=file.data.toString('utf8'),ast=ts.createSourceFile(file.path,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),changes=[];if(ast.parseDiagnostics.length)throw Error('Unreviewed Mini audio syntax');
  function visit(node){
    if(ts.isAwaitExpression(node)&&ts.isCallExpression(node.expression)&&ts.isPropertyAccessExpression(node.expression.expression)&&node.expression.expression.name.text==='resume'){
      if(node.expression.arguments.length||node.expression.expression.expression.getText(ast)!=='context')throw Error('Unreviewed Mini audio startup');changes.push({start:node.getStart(ast),end:node.end});
    }
    ts.forEachChild(node,visit);
  }
  visit(ast);if(changes.length!==1)throw Error('Unreviewed Mini audio startup count');const change=changes[0];file.data=Buffer.from(text.slice(0,change.start)+'await globalThis.GameHubResumeAudio(context)'+text.slice(change.end));guardRecordFeedback(output);return output;
}
function guardRecordFeedback(entries){
  const matches=entries.filter(file=>file.path==='src/asset-editor.js');if(matches.length!==1)throw Error('Unreviewed Mini asset file layout');const file=matches[0],text=file.data.toString('utf8'),ast=ts.createSourceFile(file.path,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),changes=[];if(ast.parseDiagnostics.length)throw Error('Unreviewed Mini asset syntax');
  function visit(node){
    if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.expression.getText(ast)==='record'&&node.expression.name.text==='addEventListener'){
      const handler=node.arguments[1];if(node.arguments.length!==2||!ts.isStringLiteral(node.arguments[0])||node.arguments[0].text!=='click'||!ts.isArrowFunction(handler)||!ts.isBlock(handler.body)||handler.body.statements.length!==2)throw Error('Unreviewed Mini record listener');
      const [declaration,attempt]=handler.body.statements,variables=ts.isVariableStatement(declaration)?declaration.declarationList.declarations:[];
      const clause=ts.isTryStatement(attempt)?attempt.catchClause:null,statement=clause?.block.statements[0];
      if(variables.length!==1||variables[0].name.getText(ast)!=='current'||variables[0].initializer?.getText(ast)!=='token'||clause?.variableDeclaration?.name.getText(ast)!=='error'||clause.block.statements.length!==1||!statement||!ts.isExpressionStatement(statement)||statement.expression.getText(ast)!=='status.textContent=error.message')throw Error('Unreviewed Mini record feedback');
      changes.push({start:statement.getStart(ast),end:statement.end});
    }
    ts.forEachChild(node,visit);
  }
  visit(ast);if(changes.length!==1)throw Error('Unreviewed Mini record listener count');const change=changes[0];file.data=Buffer.from(text.slice(0,change.start)+'if(current===token)status.textContent=error.message;'+text.slice(change.end));
}
