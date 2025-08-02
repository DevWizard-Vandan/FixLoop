import * as vscode from 'vscode';
import { AITestingService } from './aiTestingService';
import { TestRunner } from './testRunner';
import { ErrorAnalyzer } from './errorAnalyzer';
import * as diff from 'diff';

let aiTestingService: AITestingService | undefined;
let testRunner: TestRunner | undefined;
let errorAnalyzer: ErrorAnalyzer | undefined;
let testingInterval: NodeJS.Timeout | undefined;
let outputChannel: vscode.OutputChannel;
let fileWatcher: vscode.FileSystemWatcher | undefined;
let context: vscode.ExtensionContext;
// ✅ NEW: Status bar item for at-a-glance visibility
let statusBarItem: vscode.StatusBarItem;

export function activate(extensionContext: vscode.ExtensionContext) {
    context = extensionContext;
    outputChannel = vscode.window.createOutputChannel('AI Continuous Tester');
    
    // ✅ NEW: Initialize status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'aiTester.runOnce';
    updateStatusBar('idle');
    
    aiTestingService = new AITestingService(context);
    testRunner = new TestRunner(outputChannel);
    errorAnalyzer = new ErrorAnalyzer();

    const startCommand = vscode.commands.registerCommand('aiTester.start', () => {
        startContinuousTesting();
    });

    const stopCommand = vscode.commands.registerCommand('aiTester.stop', () => {
        stopContinuousTesting();
    });

    const configureCommand = vscode.commands.registerCommand('aiTester.configure', () => {
        configureExtension();
    });

    // ✅ NEW: Manual trigger command
    const runOnceCommand = vscode.commands.registerCommand('aiTester.runOnce', () => {
        runTestCycle();
    });

    context.subscriptions.push(startCommand, stopCommand, configureCommand, runOnceCommand, outputChannel, statusBarItem);

    if (vscode.workspace.workspaceFolders) {
        vscode.window.showInformationMessage('AI Continuous Tester: Ready to start testing!');
    }
}

async function startContinuousTesting() {
    if (testingInterval || fileWatcher) {
        vscode.window.showWarningMessage('AI Continuous Testing is already running!');
        return;
    }

    const config = vscode.workspace.getConfiguration('aiTester');
    const useIntervalFallback = config.get<boolean>('useIntervalFallback', false);
    const interval = config.get<number>('testInterval', 5000);

    updateStatusBar('running');
    outputChannel.appendLine('Starting AI Continuous Testing...');
    outputChannel.show();

    if (vscode.workspace.workspaceFolders) {
        const workspaceFolder = vscode.workspace.workspaceFolders[0];
        fileWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(workspaceFolder, '**/*.{js,ts,py,jsx,tsx}')
        );

        fileWatcher.onDidChange(async () => {
            logVerbose('File changed - running tests...');
            await runTestCycle();
        });

        fileWatcher.onDidCreate(async () => {
            logVerbose('File created - running tests...');
            await runTestCycle();
        });

        context.subscriptions.push(fileWatcher);
    }

    // ✅ IMPROVED: setInterval only as fallback option
    if (useIntervalFallback) {
        testingInterval = setInterval(async () => {
            logVerbose('Running scheduled test cycle...');
            await runTestCycle();
        }, interval);
        outputChannel.appendLine(`Interval fallback enabled (${interval}ms)`);
    }

    await runTestCycle();
    vscode.window.showInformationMessage('AI Continuous Testing started!');
}

function stopContinuousTesting() {
    if (testingInterval) {
        clearInterval(testingInterval);
        testingInterval = undefined;
        logVerbose('Stopped interval fallback');
    }

    if (fileWatcher) {
        fileWatcher.dispose();
        fileWatcher = undefined;
        logVerbose('Stopped file watcher');
    }

    updateStatusBar('idle');
    outputChannel.appendLine('AI Continuous Testing stopped.');
    vscode.window.showInformationMessage('AI Continuous Testing stopped!');
}

async function runTestCycle() {
    try {
        if (!vscode.workspace.workspaceFolders) {
            return;
        }

        // ✅ NEW: Update status bar to show testing in progress
        updateStatusBar('running');

        const workspaceFolder = vscode.workspace.workspaceFolders[0];
        outputChannel.appendLine(`\n--- Test Cycle ${new Date().toLocaleTimeString()} ---`);

        if (!testRunner) {
            outputChannel.appendLine('TestRunner not initialized');
            updateStatusBar('idle');
            return;
        }

        const testResults = await testRunner.runTests(workspaceFolder.uri.fsPath);
        
        if (testResults.hasErrors) {
            // ✅ NEW: Update status bar with error count
            updateStatusBar('error', testResults.errors.length);
            
            outputChannel.appendLine(`Found ${testResults.errors.length} errors. Analyzing...`);
            
            if (!errorAnalyzer) {
                outputChannel.appendLine('ErrorAnalyzer not initialized');
                return;
            }

            const analysis = await errorAnalyzer.analyzeErrors(testResults.errors);
            
            if (!aiTestingService) {
                outputChannel.appendLine('AITestingService not initialized');
                return;
            }

            const suggestions = await aiTestingService.getSuggestions(analysis, testResults.output);
            
            if (suggestions.length > 0) {
                outputChannel.appendLine('AI Suggestions:');
                suggestions.forEach((suggestion, index) => {
                    outputChannel.appendLine(`${index + 1}. [${suggestion.service}] ${suggestion.suggestion}`);
                    if (suggestion.fix) {
                        outputChannel.appendLine(`   Fix: ${suggestion.fix}`);
                    }
                });

                await showQuickFixOptions(suggestions, testResults);
            }
        } else {
            // ✅ NEW: Update status bar to show success
            updateStatusBar('success');
            outputChannel.appendLine('✅ All tests passed!');
        }
    } catch (error) {
        updateStatusBar('error', 1);
        outputChannel.appendLine(`Error during test cycle: ${error}`);
    }
}

// ✅ IMPROVED: AI Fix Diff View implementation
async function showQuickFixOptions(suggestions: any[], testResults: any) {
    const items = suggestions.map((suggestion, index) => ({
        label: `$(diff) View ${suggestion.service} Fix`,
        description: suggestion.suggestion.substring(0, 80) + '...',
        suggestion,
        action: 'diff'
    }));

    // Add option to view all suggestions
    items.push({
        label: '$(list-unordered) View All Suggestions',
        description: 'See detailed comparison of all AI suggestions',
        suggestion: null,
        action: 'viewAll'
    });

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select an AI suggestion to view or apply'
    });

    if (!selected) return;

    if (selected.action === 'viewAll') {
        await showAllSuggestionsView(suggestions);
        return;
    }

    if (selected.suggestion && selected.suggestion.fix) {
        await showDiffView(selected.suggestion, testResults);
    }
}

async function showDiffView(suggestion: any, testResults: any) {
    try {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showWarningMessage('No active editor found');
            return;
        }

        const originalUri = activeEditor.document.uri;
        const originalContent = activeEditor.document.getText();

        // Create a temporary file with the AI fix applied
        const fixedContent = applyAIFix(originalContent, suggestion.fix, testResults);
        
        const tempUri = vscode.Uri.parse(`untitled:${originalUri.path}.ai-fix`);
        
        // Open diff view
        await vscode.workspace.openTextDocument(tempUri).then(async (doc) => {
            const edit = new vscode.WorkspaceEdit();
            edit.insert(tempUri, new vscode.Position(0, 0), fixedContent);
            await vscode.workspace.applyEdit(edit);
            
            await vscode.commands.executeCommand(
                'vscode.diff', 
                originalUri, 
                tempUri, 
                `Original ↔ ${suggestion.service} Fix`
            );

            // Show option to apply the fix
            const apply = await vscode.window.showInformationMessage(
                `Apply ${suggestion.service} fix?`,
                'Apply Fix',
                'Cancel'
            );

            if (apply === 'Apply Fix') {
                await applyFixToEditor(activeEditor, fixedContent);
                vscode.window.showInformationMessage(`${suggestion.service} fix applied!`);
            }
        });

    } catch (error) {
        logVerbose(`Error showing diff view: ${error}`);
        vscode.window.showErrorMessage('Failed to show diff view');
    }
}

async function showAllSuggestionsView(suggestions: any[]) {
    const panel = vscode.window.createWebviewPanel(
        'aiSuggestions',
        'AI Suggestions Comparison',
        vscode.ViewColumn.Beside,
        { enableScripts: true }
    );

    panel.webview.html = generateSuggestionsHTML(suggestions);
}

function generateSuggestionsHTML(suggestions: any[]): string {
    const suggestionsHTML = suggestions.map((suggestion, index) => `
        <div class="suggestion">
            <h3>${suggestion.service} (Confidence: ${Math.round(suggestion.confidence * 100)}%)</h3>
            <p><strong>Suggestion:</strong> ${suggestion.suggestion}</p>
            ${suggestion.fix ? `<pre><code>${suggestion.fix}</code></pre>` : ''}
        </div>
    `).join('');

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: var(--vscode-font-family); padding: 20px; }
                .suggestion { margin-bottom: 30px; border: 1px solid var(--vscode-panel-border); padding: 15px; border-radius: 5px; }
                h3 { color: var(--vscode-textLink-foreground); margin-top: 0; }
                pre { background: var(--vscode-textBlockQuote-background); padding: 10px; border-radius: 3px; overflow-x: auto; }
                code { font-family: var(--vscode-editor-font-family); }
            </style>
        </head>
        <body>
            <h1>AI Suggestions Comparison</h1>
            ${suggestionsHTML}
        </body>
        </html>
    `;
}

// ✅ IMPROVED: Smarter code application using diff library
function applyAIFix(originalContent: string, fix: string, testResults: any): string {
    try {
        // Try to intelligently merge the fix with the original content
        const lines = originalContent.split('\n');
        const fixLines = fix.split('\n');

        // If the fix looks like a complete function or block, try to replace intelligently
        if (fix.includes('function ') || fix.includes('const ') || fix.includes('class ')) {
            // For function/class replacements, try to find the matching function/class
            const functionMatch = fix.match(/(?:function|const|class)\s+(\w+)/);
            if (functionMatch) {
                const functionName = functionMatch[1];
                const existingFunctionIndex = lines.findIndex(line => 
                    line.includes(`function ${functionName}`) || 
                    line.includes(`const ${functionName}`) ||
                    line.includes(`class ${functionName}`)
                );

                if (existingFunctionIndex !== -1) {
                    // Find the end of the function/class (simple heuristic)
                    let endIndex = existingFunctionIndex;
                    let braceCount = 0;
                    for (let i = existingFunctionIndex; i < lines.length; i++) {
                        const line = lines[i];
                        braceCount += (line.match(/\{/g) || []).length;
                        braceCount -= (line.match(/\}/g) || []).length;
                        if (braceCount === 0 && i > existingFunctionIndex) {
                            endIndex = i;
                            break;
                        }
                    }

                    // Replace the function/class with the fixed version
                    const newLines = [
                        ...lines.slice(0, existingFunctionIndex),
                        '// AI Generated Fix:',
                        ...fixLines,
                        ...lines.slice(endIndex + 1)
                    ];
                    return newLines.join('\n');
                }
            }
        }

        // If we can't do smart replacement, use diff to create a patch
        const patches = diff.createPatch('original', originalContent, originalContent + '\n\n// AI Generated Fix:\n' + fix);
        
        // For now, append the fix with clear marking
        return originalContent + '\n\n// === AI Generated Fix ===\n' + fix + '\n// === End AI Fix ===\n';

    } catch (error) {
        logVerbose(`Error applying AI fix: ${error}`);
        // Fallback to simple append
        return originalContent + '\n\n// AI Suggested Fix:\n' + fix;
    }
}

async function applyFixToEditor(editor: vscode.TextEditor, newContent: string) {
    const document = editor.document;
    const originalContent = document.getText();

    // ✅ NEW: Use diff to apply only the changes, not replace everything
    try {
        const patches = diff.structuredPatch(
            'original', 
            'fixed', 
            originalContent, 
            newContent, 
            '', 
            ''
        );

        const edit = new vscode.WorkspaceEdit();
        
        // Apply hunks one by one
        for (const hunk of patches.hunks) {
            const startLine = hunk.oldStart - 1; // VS Code uses 0-based indexing
            const endLine = startLine + hunk.oldLines;
            
            const range = new vscode.Range(
                new vscode.Position(startLine, 0),
                new vscode.Position(Math.min(endLine, document.lineCount - 1), 0)
            );

            const newText = hunk.lines
                .filter(line => !line.startsWith('-'))
                .map(line => line.substring(1))
                .join('\n');

            edit.replace(document.uri, range, newText);
        }

        await vscode.workspace.applyEdit(edit);
        
    } catch (error) {
        logVerbose(`Error applying diff patch: ${error}`);
        
        // Fallback to full replacement if diff fails
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
        );
        
        await editor.edit(editBuilder => {
            editBuilder.replace(fullRange, newContent);
        });
    }
}

async function configureExtension() {
    try {
        const geminiKey = await vscode.window.showInputBox({
            prompt: 'Enter Gemini API Key (leave empty to skip)',
            password: true,
            placeHolder: 'Your Gemini API key...'
        });

        const openaiKey = await vscode.window.showInputBox({
            prompt: 'Enter OpenAI API Key (leave empty to skip)',
            password: true,
            placeHolder: 'Your OpenAI API key...'
        });

        const claudeKey = await vscode.window.showInputBox({
            prompt: 'Enter Claude API Key (leave empty to skip)',
            password: true,
            placeHolder: 'Your Claude API key...'
        });

        if (geminiKey && geminiKey.trim()) {
            await context.secrets.store('geminiApiKey', geminiKey.trim());
            outputChannel.appendLine('Gemini API key stored securely');
        }

        if (openaiKey && openaiKey.trim()) {
            await context.secrets.store('openaiApiKey', openaiKey.trim());
            outputChannel.appendLine('OpenAI API key stored securely');
        }

        if (claudeKey && claudeKey.trim()) {
            await context.secrets.store('claudeApiKey', claudeKey.trim());
            outputChannel.appendLine('Claude API key stored securely');
        }

        vscode.window.showInformationMessage('Configuration updated securely!');
    } catch (error) {
        outputChannel.appendLine(`Error configuring extension: ${error}`);
        vscode.window.showErrorMessage('Failed to configure extension. Check output for details.');
    }
}

// ✅ NEW: Status bar management for at-a-glance visibility
function updateStatusBar(state: 'idle' | 'running' | 'success' | 'error', errorCount: number = 0) {
    if (state === 'idle') {
        statusBarItem.text = `$(check) AI Tester`;
        statusBarItem.tooltip = 'AI Tester is idle - Click to run tests';
        statusBarItem.backgroundColor = undefined;
    } else if (state === 'running') {
        statusBarItem.text = `$(sync~spin) AI Tester`;
        statusBarItem.tooltip = 'Running tests...';
        statusBarItem.backgroundColor = undefined;
    } else if (state === 'success') {
        statusBarItem.text = `$(pass) AI Tester`;
        statusBarItem.tooltip = 'All tests passed!';
        statusBarItem.backgroundColor = undefined;
    } else if (state === 'error') {
        statusBarItem.text = `$(error) AI Tester: ${errorCount}`;
        statusBarItem.tooltip = `${errorCount} test${errorCount === 1 ? '' : 's'} failed - Click to run again`;
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }
    statusBarItem.show();
}

// ✅ NEW: Verbose logging utility
function logVerbose(message: string) {
    const config = vscode.workspace.getConfiguration('aiTester');
    const verboseLogs = config.get<boolean>('verboseLogs', false);
    
    if (verboseLogs) {
        outputChannel.appendLine(`[VERBOSE] ${message}`);
    }
}

export function deactivate() {
    if (testingInterval) {
        clearInterval(testingInterval);
    }
    if (fileWatcher) {
        fileWatcher.dispose();
    }
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}