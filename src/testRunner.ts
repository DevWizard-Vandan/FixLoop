import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export interface TestResults {
    hasErrors: boolean;
    errors: TestError[];
    output: string;
}

export interface TestError {
    file: string;
    line: number;
    message: string;
    type: string;
}

interface DetectedFramework {
    name: string;
    command: string;
    confidence: number;
}

export class TestRunner {
    private selectedFramework: string | null = null;

    constructor(private outputChannel: vscode.OutputChannel) {}

    async runTests(workspacePath: string): Promise<TestResults> {
        try {
            const testCommand = await this.getTestCommand(workspacePath);
            
            if (!testCommand) {
                return {
                    hasErrors: false,
                    errors: [],
                    output: 'No test framework detected'
                };
            }

            const shellOptions = {
                cwd: workspacePath,
                shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
                timeout: 30000
            };

            this.logVerbose(`Test command: ${testCommand}`);

            const { stdout, stderr } = await execAsync(testCommand, shellOptions);
            const output = stdout + stderr;
            
            this.outputChannel.appendLine(`Test command: ${testCommand}`);
            this.outputChannel.appendLine(`Test output: ${output}`);

            return {
                hasErrors: stderr.length > 0 || this.containsTestFailures(output),
                errors: this.parseErrors(output),
                output
            };
        } catch (error: any) {
            const errorOutput = (error.stdout || '') + (error.stderr || '');
            return {
                hasErrors: true,
                errors: this.parseErrors(errorOutput + error.message),
                output: errorOutput || error.message
            };
        }
    }

    // ✅ NEW: Prioritize custom command, then show framework picker for multiple detections
    private async getTestCommand(workspacePath: string): Promise<string | null> {
        // 1. Check for custom test command override
        const config = vscode.workspace.getConfiguration('aiTester');
        const customCommand = config.get<string>('customTestCommand', '').trim();
        
        if (customCommand) {
            this.logVerbose(`Using custom test command: ${customCommand}`);
            return customCommand;
        }

        // 2. If we have a previously selected framework in this session, use it
        if (this.selectedFramework) {
            this.logVerbose(`Using previously selected framework: ${this.selectedFramework}`);
            return this.selectedFramework;
        }

        // 3. Auto-detect available frameworks
        const detectedFrameworks = await this.detectAllFrameworks(workspacePath);
        
        if (detectedFrameworks.length === 0) {
            return null;
        }

        if (detectedFrameworks.length === 1) {
            this.selectedFramework = detectedFrameworks[0].command;
            return this.selectedFramework;
        }

        // ✅ NEW: Multiple frameworks detected - show QuickPick
        return await this.showFrameworkPicker(detectedFrameworks);
    }

    // ✅ NEW: Framework picker for multiple detected frameworks
    private async showFrameworkPicker(frameworks: DetectedFramework[]): Promise<string | null> {
        const items = frameworks.map(fw => ({
            label: fw.name,
            description: fw.command,
            detail: `Confidence: ${Math.round(fw.confidence * 100)}%`,
            command: fw.command
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Multiple test frameworks detected. Choose one for this session:',
            ignoreFocusOut: true
        });

        if (selected) {
            this.selectedFramework = selected.command;
            this.logVerbose(`Selected framework: ${selected.label} (${selected.command})`);
            return selected.command;
        }

        return null;
    }

    // ✅ IMPROVED: Detect all possible frameworks with confidence scores
    private async detectAllFrameworks(workspacePath: string): Promise<DetectedFramework[]> {
        const frameworks: DetectedFramework[] = [];

        try {
            const packageJsonPath = path.join(workspacePath, 'package.json');
            
            if (await this.fileExists(packageJsonPath)) {
                const fileContent = await fs.readFile(packageJsonPath, 'utf8');
                const packageJson = JSON.parse(fileContent);
                
                // Check for explicit test script first (highest confidence)
                if (packageJson.scripts?.test) {
                    frameworks.push({
                        name: 'npm test (package.json script)',
                        command: this.getNodeCommand('npm test'),
                        confidence: 0.95
                    });
                }
                
                const dependencies = {
                    ...packageJson.dependencies,
                    ...packageJson.devDependencies
                };

                // Check for specific testing frameworks
                if (dependencies.jest) {
                    frameworks.push({
                        name: 'Jest',
                        command: this.getNodeCommand('npx jest --no-coverage --passWithNoTests'),
                        confidence: 0.9
                    });
                }
                
                if (dependencies.mocha) {
                    frameworks.push({
                        name: 'Mocha',
                        command: this.getNodeCommand('npx mocha'),
                        confidence: 0.85
                    });
                }

                if (dependencies.vitest) {
                    frameworks.push({
                        name: 'Vitest',
                        command: this.getNodeCommand('npx vitest run'),
                        confidence: 0.85
                    });
                }

                if (dependencies['@playwright/test']) {
                    frameworks.push({
                        name: 'Playwright',
                        command: this.getNodeCommand('npx playwright test'),
                        confidence: 0.8
                    });
                }

                if (dependencies.cypress) {
                    frameworks.push({
                        name: 'Cypress',
                        command: this.getNodeCommand('npx cypress run'),
                        confidence: 0.8
                    });
                }
            }

            // Python framework detection
            if (await this.fileExists(path.join(workspacePath, 'pytest.ini')) || 
                await this.fileExists(path.join(workspacePath, 'requirements.txt'))) {
                frameworks.push({
                    name: 'pytest (detected config)',
                    command: this.getPythonCommand('python -m pytest -v --tb=short'),
                    confidence: 0.9
                });
            }

            const pythonTestFiles = await this.findPythonTestFiles(workspacePath);
            if (pythonTestFiles.length > 0) {
                frameworks.push({
                    name: `pytest (${pythonTestFiles.length} test files found)`,
                    command: this.getPythonCommand('python -m pytest -v --tb=short'),
                    confidence: 0.8
                });
            }

            // Go framework detection
            if (await this.fileExists(path.join(workspacePath, 'go.mod'))) {
                frameworks.push({
                    name: 'Go test',
                    command: 'go test ./...',
                    confidence: 0.9
                });
            }

            // Rust framework detection
            if (await this.fileExists(path.join(workspacePath, 'Cargo.toml'))) {
                frameworks.push({
                    name: 'Cargo test',
                    command: 'cargo test',
                    confidence: 0.9
                });
            }

        } catch (error) {
            this.logVerbose(`Error detecting test frameworks: ${error}`);
        }

        // Sort by confidence (highest first)
        return frameworks.sort((a, b) => b.confidence - a.confidence);
    }

    private getNodeCommand(command: string): string {
        if (process.platform === 'win32') {
            return command.replace('npm', 'npm.cmd').replace('npx', 'npx.cmd');
        }
        return command;
    }

    private getPythonCommand(command: string): string {
        if (process.platform === 'win32') {
            return command.replace('python', 'python.exe');
        }
        return command.replace('python', 'python3');
    }

    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.stat(filePath);
            return true;
        } catch {
            return false;
        }
    }

    private async findPythonTestFiles(workspacePath: string): Promise<string[]> {
        try {
            const files = await fs.readdir(workspacePath);
            return files.filter(file => 
                file.startsWith('test_') && file.endsWith('.py') ||
                file.endsWith('_test.py')
            );
        } catch {
            return [];
        }
    }

    private containsTestFailures(output: string): boolean {
        const failureIndicators = [
            'FAILED', 'FAIL', 'failed', 'Error:', 'AssertionError',
            'TypeError', 'ReferenceError', 'SyntaxError', '✕', '✗',
            'test failed', 'tests failed', 'failure', 'failures'
        ];

        return failureIndicators.some(indicator => 
            output.toLowerCase().includes(indicator.toLowerCase())
        );
    }

    private parseErrors(output: string): TestError[] {
        const errors: TestError[] = [];
        const lines = output.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Jest/JavaScript patterns
            const jestMatch = line.match(/at (.+):(\d+):(\d+)/) || 
                             line.match(/(.+\.(?:js|ts|jsx|tsx)):(\d+):(\d+)/);
            if (jestMatch) {
                errors.push({
                    file: jestMatch[1],
                    line: parseInt(jestMatch[2]),
                    message: this.getContextualError(lines, i),
                    type: 'jest'
                });
                continue;
            }

            // Python patterns
            const pythonMatch = line.match(/File "(.+)", line (\d+)/) ||
                               line.match(/(.+\.py):(\d+):/);
            if (pythonMatch) {
                errors.push({
                    file: pythonMatch[1],
                    line: parseInt(pythonMatch[2]),
                    message: this.getContextualError(lines, i),
                    type: 'python'
                });
                continue;
            }

            // Go patterns
            const goMatch = line.match(/(.+\.go):(\d+):/);
            if (goMatch) {
                errors.push({
                    file: goMatch[1],
                    line: parseInt(goMatch[2]),
                    message: this.getContextualError(lines, i),
                    type: 'go'
                });
                continue;
            }

            // Generic error patterns
            if (this.isErrorLine(line)) {
                errors.push({
                    file: 'unknown',
                    line: 0,
                    message: line.trim(),
                    type: 'generic'
                });
            }
        }

        return errors;
    }

    private getContextualError(lines: string[], currentIndex: number): string {
        const start = Math.max(0, currentIndex - 1);
        const end = Math.min(lines.length, currentIndex + 2);
        return lines.slice(start, end).join('\n').trim();
    }

    private isErrorLine(line: string): boolean {
        const errorPatterns = [
            /error:/i, /fail/i, /✕/, /✗/, /exception/i,
            /assertion.*error/i, /reference.*error/i, /type.*error/i,
            /syntax.*error/i, /runtime.*error/i
        ];

        return errorPatterns.some(pattern => pattern.test(line));
    }

    private logVerbose(message: string) {
        const config = vscode.workspace.getConfiguration('aiTester');
        const verboseLogs = config.get<boolean>('verboseLogs', false);
        
        if (verboseLogs) {
            this.outputChannel.appendLine(`[VERBOSE] ${message}`);
        }
    }

    // Method to reset framework selection (useful for testing different frameworks)
    public resetFrameworkSelection() {
        this.selectedFramework = null;
        this.logVerbose('Framework selection reset');
    }
}