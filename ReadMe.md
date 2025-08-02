# AI Continuous Testing Extension

🤖 **An intelligent VS Code extension that continuously tests your code and uses multiple AI services to provide automated error fixes and suggestions.**

![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![AI Powered](https://img.shields.io/badge/AI-Powered-brightgreen)

## ✨ Features

### 🔄 **Intelligent Continuous Testing**
- **File System Watcher**: Automatically runs tests when files change (primary method)
- **Interval Fallback**: Optional scheduled testing with configurable intervals
- **Manual Trigger**: Run tests on-demand with Command Palette
- **Multi-Framework Support**: Auto-detects Jest, Mocha, Vitest, Playwright, Cypress, pytest, Go test, and more

### 🧠 **Multi-AI Integration**
- **Triple AI Power**: Get suggestions from Gemini, ChatGPT, and Claude simultaneously
- **Smart Error Analysis**: Advanced categorization and pattern detection
- **Context-Aware Prompts**: AI suggestions adapt based on error types (syntax, type, async, etc.)
- **Confidence Scoring**: Each AI suggestion includes confidence levels

### 🔧 **Advanced Code Fixing**
- **Diff View Integration**: Visual comparison between original and AI-fixed code
- **Smart Code Application**: Uses diff algorithms for precise, line-by-line changes
- **Side-by-Side Comparison**: Compare all AI suggestions in a unified interface
- **Safe Application**: Review changes before applying with built-in diff viewer

### 🎯 **Developer Experience**
- **Status Bar Integration**: At-a-glance testing status with visual indicators
- **Framework Auto-Detection**: Intelligent detection with confidence scoring
- **Custom Command Override**: Use your own test commands when needed
- **Verbose Logging**: Detailed debugging information when enabled
- **Secure Credential Storage**: API keys stored safely using VS Code's SecretStorage

## 🚀 Quick Start

### 1. Installation
# Install from VS Code Marketplace (coming soon)
# Or install from .vsix file
code --install-extension ai-continuous-tester-0.0.1.vsix

### 2. Configure API Keys
1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run: `Configure AI Testing`
3. Enter your API keys (get them from the links below)

### 3. Start Testing
- **Auto Start**: `Start AI Continuous Testing`
- **Manual Run**: `Run AI Continuous Tests`
- **Quick Access**: Click the status bar item

## 🔑 API Keys Required

| Service    | Get Your Key | Model Used |
|------------|--------------|------------|
| **Gemini** | [Google AI Studio](https://makersuite.google.com/app/apikey) | `gemini-pro` |
| **OpenAI** | [OpenAI Platform](https://platform.openai.com/api-keys) | `gpt-3.5-turbo` |
| **Claude** | [Anthropic Console](https://console.anthropic.com/) | `claude-3-sonnet` |

## 📋 Commands

|         Command                | Description | Shortcut |
|--------------------------------|-------------|----------|
| `Start AI Continuous Testing` | Begin file monitoring and testing | - |
| `Stop AI Continuous Testing` | Stop the monitoring process | - |
| `Run AI Continuous Tests` | Manual one-time test execution | - |
| `Configure AI Testing` | Set up API keys securely | - |

## ⚙️ Configuration

{
  "aiTester.testInterval": 5000,
  "aiTester.enabledServices": ["gemini", "openai", "claude"],
  "aiTester.useIntervalFallback": false,
  "aiTester.customTestCommand": "",
  "aiTester.verboseLogs": false
}

### Configuration Options

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `testInterval` | number | `5000` | Interval between tests (ms) when fallback is enabled |
| `enabledServices` | array | `["gemini", "openai", "claude"]` | Which AI services to use |
| `useIntervalFallback` | boolean | `false` | Use scheduled testing as fallback |
| `customTestCommand` | string | `""` | Override auto-detected test command |
| `verboseLogs` | boolean | `false` | Enable detailed logging for debugging |

## 🧪 Supported Test Frameworks

### JavaScript/TypeScript
- ✅ **Jest** - `npx jest`
- ✅ **Mocha** - `npx mocha`
- ✅ **Vitest** - `npx vitest run`
- ✅ **Playwright** - `npx playwright test`
- ✅ **Cypress** - `npx cypress run`
- ✅ **npm test** - Custom package.json scripts

### Python
- ✅ **pytest** - `python -m pytest`
- ✅ **unittest** - Auto-detected from test files

### Other Languages
- ✅ **Go** - `go test ./...`
- ✅ **Rust** - `cargo test`

## 🔍 How It Works

1. **File Monitoring**: Extension watches for changes in `.js`, `.ts`, `.py`, `.jsx`, `.tsx` files
2. **Smart Detection**: Automatically detects your test framework with confidence scoring
3. **Test Execution**: Runs appropriate test command for your project
4. **Error Analysis**: Categorizes errors and identifies patterns
5. **AI Consultation**: Sends context-rich prompts to multiple AI services
6. **Suggestion Presentation**: Shows suggestions with diff views for easy review
7. **Smart Application**: Applies fixes using precise diff algorithms

## 🎨 Status Bar Indicators

| Icon | Status | Description |
|------|--------|-------------|
| `$(check) AI Tester` | Idle | Ready to run tests |
| `$(sync~spin) AI Tester` | Running | Tests in progress |
| `$(pass) AI Tester` | Success | All tests passed |
| `$(error) AI Tester: N` | Errors | N tests failed |

## 🔧 Advanced Usage

### Custom Test Commands
{
  "aiTester.customTestCommand": "npm run test:unit"
}

### Multiple Framework Projects
The extension will detect multiple frameworks and let you choose which one to use for the current session.

### Framework Priority (Auto-Detection)
1. Custom command (if specified)
2. `npm test` script (highest confidence)
3. Specific framework detection (Jest, Mocha, etc.)
4. Language-specific defaults (pytest for Python, go test for Go)

## 🐛 Troubleshooting

### Tests Not Running?
- ✅ Check that your test framework is installed
- ✅ Verify test commands work in terminal
- ✅ Enable verbose logging for detailed output
- ✅ Try setting a custom test command

### AI Suggestions Not Appearing?
- ✅ Verify API keys are configured
- ✅ Check network connectivity
- ✅ Enable verbose logging to see API errors
- ✅ Try disabling/enabling specific AI services

### Performance Issues?
- ✅ Disable interval fallback (use file watcher only)
- ✅ Exclude unnecessary files from workspace
- ✅ Adjust test timeout in framework config

## 🛡️ Privacy & Security

- 🔒 **API Keys**: Stored securely using VS Code's SecretStorage
- 🔒 **Code Privacy**: Only error context and test output sent to AI services
- 🔒 **No Data Storage**: No code or data stored by the extension
- 🔒 **HTTPS Only**: All AI communications use encrypted connections

## 🚀 Development

### Building from Source
```bash
git clone <repository-url>
cd ai-continuous-tester
npm install
npm run build
```

### Running in Development
```bash
npm run watch
# Press F5 in VS Code to launch Extension Development Host
```

### Testing
```bash
npm run lint
npm run build
```

### Packaging
```bash
npm install -g @vscode/vsce
vsce package
```

## 📊 What Makes This Different?

### 🎯 **Intelligent Error Analysis**
Unlike simple test runners, this extension:
- Categorizes errors by type (Syntax, Type, Reference, etc.)
- Identifies patterns across multiple errors
- Provides context-aware AI prompts
- Generates specific recommendations

### 🤖 **Multi-AI Approach**
- **Consensus Building**: Multiple AI opinions for better solutions
- **Confidence Scoring**: Know which suggestions are most reliable
- **Service Redundancy**: If one AI service is down, others continue working
- **Specialized Prompts**: Each error type gets tailored prompts

### 🔍 **Visual Code Review**
- **Diff Integration**: Built-in VS Code diff viewer
- **Side-by-Side Comparison**: See all AI suggestions at once
- **Safe Application**: Never applies changes without your review
- **Precise Patching**: Uses diff algorithms for surgical code changes

## 📈 Example Workflow

```
1. Developer saves a JavaScript file
   ↓
2. Extension detects change via FileSystemWatcher
   ↓
3. Runs detected test framework (e.g., Jest)
   ↓
4. Finds 3 TypeError issues
   ↓
5. Analyzes errors: "Type conversion needed"
   ↓
6. Sends specialized prompts to Gemini, ChatGPT, Claude
   ↓
7. Shows suggestions with confidence scores:
   • Claude (90%): Add parseInt() conversion
   • ChatGPT (85%): Use Number() constructor  
   • Gemini (80%): Add type checking
   ↓
8. Developer reviews diff view
   ↓
9. Applies Claude's suggestion with one click
   ↓
10. Tests automatically re-run and pass ✅
```

## 🏆 Best Practices

### 🎯 **Optimal Setup**
- Use file watcher mode (disable interval fallback)
- Enable verbose logging during initial setup
- Configure custom test commands for complex projects
- Start with all AI services enabled, then customize

### 🔧 **Performance Tips**
- Exclude `node_modules`, `dist`, `build` from VS Code file watching
- Use specific test commands rather than broad ones
- Consider test timeouts for large test suites

### 🧪 **Testing Strategy**
- Let the extension handle simple fixes automatically
- Use diff view for complex changes
- Keep AI suggestions as learning opportunities
- Review patterns in error analysis for code improvements

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### 🐛 **Bug Reports**
- Use GitHub Issues with detailed reproduction steps
- Include VS Code version, extension version, and platform
- Enable verbose logging and include relevant output

### 💡 **Feature Requests**
- Check existing issues first
- Describe the use case and expected behavior
- Consider backward compatibility

### 🔧 **Code Contributions**
1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

## 📝 Changelog

### v0.0.1 (Current)
- ✅ Initial release
- ✅ Multi-AI integration (Gemini, ChatGPT, Claude)
- ✅ File system watcher with interval fallback
- ✅ Framework auto-detection with QuickPick
- ✅ Visual diff integration
- ✅ Status bar indicators
- ✅ Smart code application with diff algorithms
- ✅ Enhanced error analysis and recommendations
- ✅ Configurable test command override
- ✅ Verbose logging option

## 🔮 Roadmap

### 🎯 **Next Release (v0.1.0)**
- [ ] Test result caching for faster iterations
- [ ] Git integration for change-based testing
- [ ] Custom AI prompt templates
- [ ] Test coverage integration
- [ ] Performance metrics dashboard

### 🚀 **Future Versions**
- [ ] Local AI model support (Ollama integration)
- [ ] Team collaboration features
- [ ] CI/CD pipeline integration
- [ ] Advanced code refactoring suggestions
- [ ] Integration with more testing frameworks

## ❓ FAQ

### **Q: Does this work offline?**
A: The extension needs internet connectivity to reach AI services. Local file watching and test execution work offline.

### **Q: How much do the AI services cost?**
A: Costs vary by service and usage. Most developers spend $1-5/month for typical usage. Check each provider's pricing.

### **Q: Can I use just one AI service?**
A: Yes! Configure `aiTester.enabledServices` to include only your preferred service(s).

### **Q: Does this slow down VS Code?**
A: No. The extension uses efficient file watching and runs tests in separate processes.

### **Q: What languages are supported?**
A: Currently JavaScript/TypeScript, Python, Go, and Rust. More languages coming soon!

### **Q: Can I use this in a monorepo?**
A: Yes! The extension detects multiple frameworks and lets you choose the appropriate one.

## 📞 Support

- 📧 **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)
- 📖 **Documentation**: [Wiki](https://github.com/your-repo/wiki)

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- VS Code Extension API team for excellent documentation
- AI service providers (Google, OpenAI, Anthropic) for powerful APIs
- Testing framework maintainers for robust tools
- Open source community for inspiration and feedback

---

**🚀 Ready to revolutionize your testing workflow? Install AI Continuous Tester today!**

*Made with ❤️ for developers who want AI-powered testing automation*