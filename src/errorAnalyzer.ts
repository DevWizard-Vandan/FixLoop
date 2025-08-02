import * as vscode from 'vscode';

export class ErrorAnalyzer {
    async analyzeErrors(errors: any[]): Promise<any> {
        const analysis = {
            errorCount: errors.length,
            errorTypes: this.categorizeErrors(errors),
            patterns: this.findPatterns(errors),
            severity: this.assessSeverity(errors),
            context: this.gatherContext(errors),
            // ✅ NEW: Enhanced analysis features
            recommendations: this.generateRecommendations(errors),
            errorFrequency: this.analyzeErrorFrequency(errors),
            affectedLanguages: this.detectAffectedLanguages(errors)
        };

        this.logVerbose(`Analyzed ${errors.length} errors with ${Object.keys(analysis.errorTypes).length} different types`);
        return analysis;
    }

    private categorizeErrors(errors: any[]): Record<string, number> {
        const categories: Record<string, number> = {};
        
        errors.forEach(error => {
            const category = this.getErrorCategory(error.message);
            categories[category] = (categories[category] || 0) + 1;
        });

        return categories;
    }

    // ✅ IMPROVED: Better error categorization
    private getErrorCategory(message: string): string {
        const lowerMessage = message.toLowerCase();

        // Syntax errors
        if (lowerMessage.includes('syntaxerror') || lowerMessage.includes('syntax error')) {
            return 'Syntax Error';
        }

        // Type errors
        if (lowerMessage.includes('typeerror') || lowerMessage.includes('type error')) {
            return 'Type Error';
        }

        // Reference errors
        if (lowerMessage.includes('referenceerror') || lowerMessage.includes('reference error')) {
            return 'Reference Error';
        }

        // Test assertion errors
        if (lowerMessage.includes('assertionerror') || lowerMessage.includes('assertion') || 
            lowerMessage.includes('expected') || lowerMessage.includes('toBe') || 
            lowerMessage.includes('toEqual')) {
            return 'Test Assertion';
        }

        // Undefined/null errors
        if (lowerMessage.includes('undefined') || lowerMessage.includes('null') ||
            lowerMessage.includes('cannot read property') || lowerMessage.includes('cannot access before initialization')) {
            return 'Undefined Variable';
        }

        // Import/Module errors
        if (lowerMessage.includes('module') || lowerMessage.includes('import') || 
            lowerMessage.includes('require') || lowerMessage.includes('cannot resolve')) {
            return 'Module Error';
        }

        // Async/Promise errors
        if (lowerMessage.includes('promise') || lowerMessage.includes('async') || 
            lowerMessage.includes('await') || lowerMessage.includes('unhandled rejection')) {
            return 'Async Error';
        }

        // Network/HTTP errors
        if (lowerMessage.includes('network') || lowerMessage.includes('fetch') || 
            lowerMessage.includes('xhr') || lowerMessage.includes('timeout')) {
            return 'Network Error';
        }

        // File system errors
        if (lowerMessage.includes('file') || lowerMessage.includes('path') || 
            lowerMessage.includes('directory') || lowerMessage.includes('enoent')) {
            return 'File System Error';
        }

        return 'Other';
    }

    // ✅ IMPROVED: Enhanced pattern detection
    private findPatterns(errors: any[]): string[] {
        const patterns: string[] = [];
        const messages = errors.map(e => e.message.toLowerCase());
        
        // Check for specific patterns
        if (messages.some(m => m.includes('undefined') || m.includes('null'))) {
            patterns.push('Undefined variables detected');
        }
        
        if (messages.some(m => m.includes('async') || m.includes('promise') || m.includes('await'))) {
            patterns.push('Async/Promise related issues');
        }

        if (messages.some(m => m.includes('import') || m.includes('require') || m.includes('module'))) {
            patterns.push('Module import/require issues');
        }

        if (messages.some(m => m.includes('timeout') || m.includes('network'))) {
            patterns.push('Network/timeout issues');
        }

        if (messages.some(m => m.includes('mock') || m.includes('spy') || m.includes('stub'))) {
            patterns.push('Testing mock/spy issues');
        }

        // Check for file-specific patterns
        const files = errors.map(e => e.file);
        if (files.some(f => f.includes('test') || f.includes('spec'))) {
            patterns.push('Test file specific errors');
        }

        if (files.some(f => f.includes('config') || f.includes('setup'))) {
            patterns.push('Configuration/setup related errors');
        }

        // Check for error clustering
        const errorsByFile = this.groupErrorsByFile(errors);
        const filesWithManyErrors = Object.keys(errorsByFile).filter(file => errorsByFile[file].length > 3);
        if (filesWithManyErrors.length > 0) {
            patterns.push(`Error clustering in specific files: ${filesWithManyErrors.join(', ')}`);
        }

        return patterns;
    }

    private assessSeverity(errors: any[]): 'low' | 'medium' | 'high' | 'critical' {
        const errorCount = errors.length;
        const errorTypes = this.categorizeErrors(errors);
        
        // Critical: Many errors or syntax errors present
        if (errorCount > 15 || errorTypes['Syntax Error'] > 0) {
            return 'critical';
        }
        
        // High: Many errors or reference errors
        if (errorCount > 10 || errorTypes['Reference Error'] > 2) {
            return 'high';
        }
        
        // Medium: Moderate errors or type issues
        if (errorCount > 5 || errorTypes['Type Error'] > 1) {
            return 'medium';
        }
        
        return 'low';
    }

    // ✅ IMPROVED: Enhanced context gathering
    private gatherContext(errors: any[]): any {
        const files = [...new Set(errors.map(e => e.file))];
        const mostCommonError = this.getMostCommonError(errors);
        const errorsByType = this.categorizeErrors(errors);
        const errorsByFile = this.groupErrorsByFile(errors);

        return {
            files,
            mostCommonError,
            timeStamp: new Date().toISOString(),
            dominantErrorType: this.getDominantErrorType(errorsByType),
            affectedFileCount: files.length,
            errorDistribution: errorsByFile,
            hasMultipleFileErrors: files.length > 1,
            hasCriticalErrors: this.assessSeverity(errors) === 'critical'
        };
    }

    // ✅ NEW: Generate specific recommendations based on error analysis
    private generateRecommendations(errors: any[]): string[] {
        const recommendations: string[] = [];
        const errorTypes = this.categorizeErrors(errors);
        const patterns = this.findPatterns(errors);

        // Syntax error recommendations
        if (errorTypes['Syntax Error'] > 0) {
            recommendations.push('Run a linter (ESLint/Pylint) to catch syntax issues early');
            recommendations.push('Consider using a code formatter (Prettier/Black) for consistent syntax');
        }

        // Type error recommendations
        if (errorTypes['Type Error'] > 3) {
            recommendations.push('Consider using TypeScript for better type safety');
            recommendations.push('Add runtime type checking or validation');
        }

        // Module error recommendations
        if (errorTypes['Module Error'] > 0) {
            recommendations.push('Verify all dependencies are installed');
            recommendations.push('Check import paths and module resolution');
        }

        // Test-specific recommendations
        if (errorTypes['Test Assertion'] > 2) {
            recommendations.push('Review test data setup and expected values');
            recommendations.push('Consider using more descriptive test assertions');
        }

        // Pattern-based recommendations
        if (patterns.includes('Async/Promise related issues')) {
            recommendations.push('Ensure proper async/await usage and error handling');
        }

        if (patterns.includes('Error clustering in specific files')) {
            recommendations.push('Focus refactoring efforts on files with multiple errors');
        }

        return recommendations;
    }

    // ✅ NEW: Analyze error frequency and trends
    private analyzeErrorFrequency(errors: any[]): any {
        const errorsByType = this.categorizeErrors(errors);
        const total = errors.length;

        return {
            mostFrequent: this.getDominantErrorType(errorsByType),
            distribution: Object.keys(errorsByType).map(type => ({
                type,
                count: errorsByType[type],
                percentage: Math.round((errorsByType[type] / total) * 100)
            })).sort((a, b) => b.count - a.count)
        };
    }

    // ✅ NEW: Detect affected programming languages
    private detectAffectedLanguages(errors: any[]): string[] {
        const languages = new Set<string>();

        errors.forEach(error => {
            if (error.type === 'jest' || error.file.match(/\.(js|ts|jsx|tsx)$/)) {
                languages.add('JavaScript/TypeScript');
            }
            if (error.type === 'python' || error.file.match(/\.py$/)) {
                languages.add('Python');
            }
            if (error.type === 'go' || error.file.match(/\.go$/)) {
                languages.add('Go');
            }
            if (error.file.match(/\.(rs|toml)$/)) {
                languages.add('Rust');
            }
        });

        return Array.from(languages);
    }

    private getMostCommonError(errors: any[]): string {
        const errorCounts: Record<string, number> = {};
        
        errors.forEach(error => {
            const key = error.message.substring(0, 50);
            errorCounts[key] = (errorCounts[key] || 0) + 1;
        });

        if (Object.keys(errorCounts).length === 0) {
            return 'No errors';
        }

        return Object.keys(errorCounts).reduce((a, b) => 
            errorCounts[a] > errorCounts[b] ? a : b
        );
    }

    private getDominantErrorType(errorsByType: Record<string, number>): string {
        if (Object.keys(errorsByType).length === 0) {
            return 'None';
        }

        return Object.keys(errorsByType).reduce((a, b) => 
            errorsByType[a] > errorsByType[b] ? a : b
        );
    }

    private groupErrorsByFile(errors: any[]): Record<string, any[]> {
        const grouped: Record<string, any[]> = {};
        
        errors.forEach(error => {
            if (!grouped[error.file]) {
                grouped[error.file] = [];
            }
            grouped[error.file].push(error);
        });

        return grouped;
    }

    private logVerbose(message: string) {
        const config = vscode.workspace.getConfiguration('aiTester');
        const verboseLogs = config.get<boolean>('verboseLogs', false);
        
        if (verboseLogs) {
            console.log(`[Error Analyzer] ${message}`);
        }
    }
}