import * as vscode from 'vscode';
import axios from 'axios';

export interface AISuggestion {
    service: string;
    suggestion: string;
    fix?: string;
    confidence: number;
}

export class AITestingService {
    constructor(private context: vscode.ExtensionContext) {}

    async getSuggestions(errorAnalysis: any, testOutput: string): Promise<AISuggestion[]> {
        const suggestions: AISuggestion[] = [];
        const config = vscode.workspace.getConfiguration('aiTester');
        const enabledServices = config.get<string[]>('enabledServices', []);

        const promises = [];

        if (enabledServices.includes('gemini')) {
            promises.push(this.getGeminiSuggestion(errorAnalysis, testOutput));
        }

        if (enabledServices.includes('openai')) {
            promises.push(this.getOpenAISuggestion(errorAnalysis, testOutput));
        }

        if (enabledServices.includes('claude')) {
            promises.push(this.getClaudeSuggestion(errorAnalysis, testOutput));
        }

        const results = await Promise.allSettled(promises);
        
        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value) {
                suggestions.push(result.value);
            }
        });

        return suggestions;
    }

    private async getGeminiSuggestion(errorAnalysis: any, testOutput: string): Promise<AISuggestion | null> {
        try {
            const apiKey = await this.context.secrets.get('geminiApiKey');
            if (!apiKey) {
                this.logVerbose('Gemini API key not found');
                return null;
            }

            const prompt = this.createDetailedPrompt(errorAnalysis, testOutput);

            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
                {
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }]
                },
                {
                    timeout: 10000,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) return null;

            return {
                service: 'Gemini',
                suggestion: this.extractSuggestion(text),
                fix: this.extractCodeFix(text),
                confidence: 0.8
            };
        } catch (error) {
            this.logVerbose(`Gemini API error: ${error}`);
            return null;
        }
    }

    private async getOpenAISuggestion(errorAnalysis: any, testOutput: string): Promise<AISuggestion | null> {
        try {
            const apiKey = await this.context.secrets.get('openaiApiKey');
            if (!apiKey) {
                this.logVerbose('OpenAI API key not found');
                return null;
            }

            const prompt = this.createDetailedPrompt(errorAnalysis, testOutput);

            const response = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a senior software engineer and debugging expert. Provide concise, actionable fixes for code errors. Format your response with a brief explanation followed by the code fix in a code block.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 800,
                    temperature: 0.3
                },
                {
                    timeout: 10000,
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const text = response.data.choices?.[0]?.message?.content;
            if (!text) return null;

            return {
                service: 'ChatGPT',
                suggestion: this.extractSuggestion(text),
                fix: this.extractCodeFix(text),
                confidence: 0.85
            };
        } catch (error) {
            this.logVerbose(`OpenAI API error: ${error}`);
            return null;
        }
    }

    private async getClaudeSuggestion(errorAnalysis: any, testOutput: string): Promise<AISuggestion | null> {
        try {
            const apiKey = await this.context.secrets.get('claudeApiKey');
            if (!apiKey) {
                this.logVerbose('Claude API key not found');
                return null;
            }

            const prompt = this.createDetailedPrompt(errorAnalysis, testOutput);

            const response = await axios.post(
                'https://api.anthropic.com/v1/messages',
                {
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 800,
                    messages: [
                        {
                            role: 'user',
                            content: `You are a senior software engineer specializing in debugging and code fixes. ${prompt}`
                        }
                    ]
                },
                {
                    timeout: 10000,
                    headers: {
                        'x-api-key': apiKey,
                        'Content-Type': 'application/json',
                        'anthropic-version': '2023-06-01'
                    }
                }
            );

            const text = response.data.content?.[0]?.text;
            if (!text) return null;

            return {
                service: 'Claude',
                suggestion: this.extractSuggestion(text),
                fix: this.extractCodeFix(text),
                confidence: 0.9
            };
        } catch (error) {
            this.logVerbose(`Claude API error: ${error}`);
            return null;
        }
    }

    // ✅ IMPROVED: Better prompt adaptation based on error type
    private createDetailedPrompt(errorAnalysis: any, testOutput: string): string {
        const basePrompt = `I need help fixing failing tests. Here's the detailed information:

ERROR ANALYSIS:
- Error Count: ${errorAnalysis.errorCount}
- Error Types: ${JSON.stringify(errorAnalysis.errorTypes, null, 2)}
- Patterns Found: ${errorAnalysis.patterns.join(', ')}
- Severity: ${errorAnalysis.severity}
- Most Common Error: ${errorAnalysis.context.mostCommonError}

FULL TEST OUTPUT:
\`\`\`
${testOutput.substring(0, 2000)}${testOutput.length > 2000 ? '\n... (truncated)' : ''}
\`\`\`

AFFECTED FILES:
${errorAnalysis.context.files.join(', ')}

Please provide:
1. A concise explanation of what's causing the errors
2. Specific code fixes to resolve the issues
3. Any additional recommendations

Format your response with the explanation first, then any code fixes in proper code blocks.`;

        // ✅ NEW: Add specialized hints based on error types
        const specializedHints = this.generateSpecializedHints(errorAnalysis);
        
        return basePrompt + specializedHints;
    }

    // ✅ NEW: Generate specialized hints based on error patterns
    private generateSpecializedHints(errorAnalysis: any): string {
        const hints: string[] = [];
        const errorTypes = errorAnalysis.errorTypes || {};
        const patterns = errorAnalysis.patterns || [];

        // Syntax Error specific hints
        if (errorTypes['Syntax Error'] > 0) {
            hints.push('\n🔧 SYNTAX ERROR HINTS:');
            hints.push('- Check for missing semicolons, brackets, or parentheses');
            hints.push('- Verify correct ES6+ syntax usage');
            hints.push('- Ensure proper import/export syntax');
        }

        // Type Error specific hints
        if (errorTypes['Type Error'] > 0) {
            hints.push('\n🔧 TYPE ERROR HINTS:');
            hints.push('- Consider adding type conversions (parseInt, parseFloat, String, etc.)');
            hints.push('- Check for null/undefined values before accessing properties');
            hints.push('- Verify variable types match expected function parameters');
        }

        // Reference Error specific hints
        if (errorTypes['Reference Error'] > 0) {
            hints.push('\n🔧 REFERENCE ERROR HINTS:');
            hints.push('- Check if variables are declared before use');
            hints.push('- Verify correct variable scoping');
            hints.push('- Ensure imports are correctly named and paths are valid');
        }

        // Undefined Variable specific hints
        if (errorTypes['Undefined Variable'] > 0) {
            hints.push('\n🔧 UNDEFINED VARIABLE HINTS:');
            hints.push('- Add null/undefined checks before accessing properties');
            hints.push('- Initialize variables with default values');
            hints.push('- Use optional chaining (?.) for safer property access');
        }

        // Test Assertion specific hints
        if (errorTypes['Test Assertion'] > 0) {
            hints.push('\n🔧 TEST ASSERTION HINTS:');
            hints.push('- Review expected vs actual values in assertions');
            hints.push('- Check if test data setup is correct');
            hints.push('- Verify mock functions are properly configured');
        }

        // Async/Promise pattern hints
        if (patterns.includes('Async/Promise related issues')) {
            hints.push('\n🔧 ASYNC/PROMISE HINTS:');
            hints.push('- Ensure async functions are properly awaited');
            hints.push('- Add proper error handling with try/catch blocks');
            hints.push('- Check for unhandled promise rejections');
            hints.push('- Consider using Promise.all() for parallel operations');
        }

        // Module import/require pattern hints
        if (patterns.includes('Module import/require issues')) {
            hints.push('\n🔧 MODULE IMPORT HINTS:');
            hints.push('- Verify file paths are correct and case-sensitive');
            hints.push('- Check if modules are installed (npm list)');
            hints.push('- Ensure consistent import/require syntax throughout project');
            hints.push('- Consider using absolute imports or path mapping');
        }

        // Framework-specific hints based on test output
        const testOutput = errorAnalysis.context?.testOutput || '';
        if (testOutput.includes('jest')) {
            hints.push('\n🔧 JEST SPECIFIC HINTS:');
            hints.push('- Check jest.config.js for proper setup');
            hints.push('- Ensure test files match the testMatch pattern');
            hints.push('- Consider using jest.mock() for external dependencies');
        }

        if (testOutput.includes('pytest')) {
            hints.push('\n🔧 PYTEST SPECIFIC HINTS:');
            hints.push('- Check fixture dependencies and scope');
            hints.push('- Verify test discovery patterns');
            hints.push('- Consider using parametrized tests for multiple inputs');
        }

        return hints.length > 0 ? '\n' + hints.join('\n') : '';
    }

    private extractSuggestion(text: string): string {
        const beforeCode = text.split('```')[0];
        return beforeCode.substring(0, 300).trim();
    }

    private extractCodeFix(text: string): string | undefined {
        const codeBlocks = text.match(/```[\s\S]*?```/g);
        if (!codeBlocks || codeBlocks.length === 0) return undefined;

        const cleanedBlock = codeBlocks[0]
            .replace(/```\w*\n?|\n?```/g, '')
            .trim();

        return cleanedBlock.length > 10 ? cleanedBlock : undefined;
    }

    private logVerbose(message: string) {
        const config = vscode.workspace.getConfiguration('aiTester');
        const verboseLogs = config.get<boolean>('verboseLogs', false);
        
        if (verboseLogs) {
            console.log(`[AI Service] ${message}`);
        }
    }
}