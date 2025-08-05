import React, { useState, useMemo } from 'react';
import { Upload, Download, Share2, TrendingUp, User, Award, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const QAAnalysisApp = () => {
  const [csvData, setCsvData] = useState(null);
  const [rawData, setRawData] = useState('');
  const [shareableId, setShareableId] = useState(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'text/csv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        setRawData(text);
        parseCSV(text);
      };
      reader.readAsText(file);
    }
  };

  const parseCSV = (csvText) => {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    const data = lines.slice(1).map(line => {
      // Handle CSV parsing with proper comma handling (including commas within quotes)
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim().replace(/"/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim().replace(/"/g, ''));
      
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    });

    setCsvData(data);
  };



  const analysisData = useMemo(() => {
    if (!csvData) return null;

    try {
      // Calculate team averages
      const totalScore = csvData.reduce((sum, row) => sum + (parseFloat(row.Score) || 0), 0);
      const teamAvgScore = totalScore / csvData.length;

      const writingStyleScores = csvData.map(row => {
        const score = parseFloat(row['Writing style (Score)']);
        return isNaN(score) ? 0 : score;
      });
      const accuracyScores = csvData.map(row => {
        const score = parseFloat(row['Accuracy (Score)']);
        return isNaN(score) ? 0 : score;
      });
      const empathyScores = csvData.map(row => {
        const score = parseFloat(row['Empathy & Helpfulness (Score)']);
        return isNaN(score) ? 0 : score;
      });

      const teamAvgWriting = writingStyleScores.reduce((a, b) => a + b, 0) / writingStyleScores.length;
      const teamAvgAccuracy = accuracyScores.reduce((a, b) => a + b, 0) / accuracyScores.length;
      const teamAvgEmpathy = empathyScores.reduce((a, b) => a + b, 0) / empathyScores.length;

      // Feedback distribution - handle lowercase values and map them
      const feedbackMapping = {
        'poor': 'Poor',
        'average': 'Average', 
        'good': 'Good',
        'excellent': 'Excellent'
      };
      
      const allowedFeedback = ['Poor', 'Average', 'Good', 'Excellent'];
      const feedbackCounts = csvData.reduce((acc, row) => {
        const rawFeedback = row['Feedback Overall']?.toLowerCase();
        const mappedFeedback = feedbackMapping[rawFeedback];
        
        if (mappedFeedback) {
          acc[mappedFeedback] = (acc[mappedFeedback] || 0) + 1;
        }
        return acc;
      }, {});

      const feedbackData = allowedFeedback.map(feedback => ({
        name: feedback,
        count: feedbackCounts[feedback] || 0
      }));

      // Per-agent analysis
      const agentData = {};
      csvData.forEach(row => {
        const agent = row['Representative Name'];
        if (!agentData[agent]) {
          agentData[agent] = {
            conversations: [],
            scores: [],
            writingScores: [],
            accuracyScores: [],
            empathyScores: []
          };
        }
        
        agentData[agent].conversations.push(row);
        
        const score = parseFloat(row.Score);
        const writingScore = parseFloat(row['Writing style (Score)']);
        const accuracyScore = parseFloat(row['Accuracy (Score)']);
        const empathyScore = parseFloat(row['Empathy & Helpfulness (Score)']);
        
        agentData[agent].scores.push(isNaN(score) ? 0 : score);
        agentData[agent].writingScores.push(isNaN(writingScore) ? 0 : writingScore);
        agentData[agent].accuracyScores.push(isNaN(accuracyScore) ? 0 : accuracyScore);
        agentData[agent].empathyScores.push(isNaN(empathyScore) ? 0 : empathyScore);
      });

      const agentAnalysis = Object.entries(agentData)
        .sort(([nameA], [nameB]) => nameA.localeCompare(nameB))
        .map(([agent, data]) => {
          const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
          const avgWriting = data.writingScores.reduce((a, b) => a + b, 0) / data.writingScores.length;
          const avgAccuracy = data.accuracyScores.reduce((a, b) => a + b, 0) / data.accuracyScores.length;
          const avgEmpathy = data.empathyScores.reduce((a, b) => a + b, 0) / data.empathyScores.length;

          const excellentConversations = data.conversations.filter(c => 
            c['Feedback Overall']?.toLowerCase() === 'excellent'
          );
          const improvementConversations = data.conversations.filter(c => {
            const feedback = c['Feedback Overall']?.toLowerCase();
            return feedback === 'poor' || feedback === 'average';
          });

          // Extract good wins from excellent conversations - look at explanation columns for positive feedback
          const goodWins = [];
          
          if (excellentConversations.length > 0) {
            // Get one writing win from the first excellent conversation that has it
            const writingWin = excellentConversations.find(c => c['Writing style (Explanation)'] && c['Writing style (Explanation)'].trim());
            if (writingWin) {
              const sentences = writingWin['Writing style (Explanation)'].split('.').filter(s => s.trim());
              const firstSentence = sentences[0]?.trim();
              if (firstSentence) {
                goodWins.push(firstSentence + '.');
              }
            }
            
            // Get one empathy win from the first excellent conversation that has it
            const empathyWin = excellentConversations.find(c => c['Empathy & Helpfulness (Explanation)'] && c['Empathy & Helpfulness (Explanation)'].trim());
            if (empathyWin) {
              const sentences = empathyWin['Empathy & Helpfulness (Explanation)'].split('.').filter(s => s.trim());
              const firstSentence = sentences[0]?.trim();
              if (firstSentence) {
                goodWins.push(firstSentence + '.');
              }
            }
          }

          // Extract recommendations from poor/average conversations for THIS SPECIFIC AGENT
          const recommendations = improvementConversations
            .map(c => c['Feedback Focus Areas'])
            .filter(f => f && f.trim() !== '')
            .map(f => f.trim());

          // Helper functions for THIS AGENT'S data
          const summarizeText = (texts, type) => {
            if (texts.length === 0) return [];
            
            // Always return the actual feedback text, just shortened and limited to 3
            if (texts.length <= 3) {
              return texts.map(text => {
                const sentences = text.split('.').filter(s => s.trim());
                // Take first 1-2 sentences to keep it concise
                return sentences.slice(0, 1).join('.') + '.';
              });
            }
            
            // For more than 3 items, take the first 3 and shorten them
            return texts.slice(0, 3).map(text => {
              const sentences = text.split('.').filter(s => s.trim());
              return sentences.slice(0, 1).join('.') + '.';
            });
          };

          // Use the helper functions to summarize THIS AGENT'S specific feedback
          const summarizedWins = summarizeText(goodWins, 'wins');
          const summarizedRecommendations = summarizeText(recommendations, 'recommendations');

          console.log(`Agent ${agent}:`, {
            excellentCount: excellentConversations.length,
            improvementCount: improvementConversations.length,
            goodWinsCount: goodWins.length,
            recommendationsCount: recommendations.length,
            summarizedWins,
            summarizedRecommendations
          });

          return {
            name: agent,
            avgScore: avgScore.toFixed(1),
            avgWriting: avgWriting.toFixed(1),
            avgAccuracy: avgAccuracy.toFixed(1),
            avgEmpathy: avgEmpathy.toFixed(1),
            totalConversations: data.conversations.length,
            excellentCount: excellentConversations.length,
            improvementCount: improvementConversations.length,
            goodWins: summarizedWins,
            recommendations: summarizedRecommendations
          };
        });

      return {
        team: {
          avgScore: teamAvgScore.toFixed(1),
          avgWriting: teamAvgWriting.toFixed(1),
          avgAccuracy: teamAvgAccuracy.toFixed(1),
          avgEmpathy: teamAvgEmpathy.toFixed(1),
          totalConversations: csvData.length
        },
        feedbackData,
        agents: agentAnalysis
      };
    } catch (error) {
      console.error('Error in analysis:', error);
      return null;
    }
  }, [csvData]);

  const generateMarkdown = () => {
    if (!analysisData) return '';

    let markdown = `# Customer Support QA Analysis Report\n\n`;
    
    markdown += `## 📊 Team Overview\n\n`;
    markdown += `### Overall Metrics\n`;
    markdown += `- **Team Average QA Score**: ${analysisData.team.avgScore}/100\n`;
    markdown += `- **Writing Style Average**: ${analysisData.team.avgWriting}/3\n`;
    markdown += `- **Accuracy Average**: ${analysisData.team.avgAccuracy}/3\n`;
    markdown += `- **Empathy & Helpfulness Average**: ${analysisData.team.avgEmpathy}/3\n`;
    markdown += `- **Total Conversations Analyzed**: ${analysisData.team.totalConversations}\n\n`;

    markdown += `### Feedback Distribution\n`;
    analysisData.feedbackData.forEach(item => {
      markdown += `- **${item.name}**: ${item.count} conversations\n`;
    });
    markdown += `\n`;

    markdown += `## 👥 Per-Agent Analysis\n\n`;
    analysisData.agents.forEach(agent => {
      markdown += `### ${agent.name}\n\n`;
      markdown += `**Performance Metrics:**\n`;
      markdown += `- Average QA Score: ${agent.avgScore}/100\n`;
      markdown += `- Writing Style: ${agent.avgWriting}/3\n`;
      markdown += `- Accuracy: ${agent.avgAccuracy}/3\n`;
      markdown += `- Empathy & Helpfulness: ${agent.avgEmpathy}/3\n`;
      markdown += `- Total Conversations: ${agent.totalConversations}\n\n`;

      if (agent.goodWins.length > 0) {
        markdown += `**✅ Good Wins (${agent.excellentCount} excellent conversations):**\n`;
        agent.goodWins.forEach(win => {
          if (win) markdown += `- ${win}\n`;
        });
        markdown += `\n`;
      }

      if (agent.recommendations.length > 0) {
        markdown += `**⚠️ Recommendations for Improvement (${agent.improvementCount} conversations needing attention):**\n`;
        agent.recommendations.forEach(rec => {
          if (rec) markdown += `- ${rec}\n`;
        });
        markdown += `\n`;
      }

      markdown += `---\n\n`;
    });

    return markdown;
  };

  const downloadMarkdown = () => {
    const markdown = generateMarkdown();
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'qa-analysis-report.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateShareableLink = () => {
    // Since we don't have a backend to store analysis data, 
    // we'll copy the current page URL instead
    const currentUrl = window.location.href;
    navigator.clipboard.writeText(currentUrl);
    
    setShareableId('current-session');
    
    // Show a more helpful message
    setTimeout(() => {
      setShareableId(null);
    }, 3000);
  };

  if (!csvData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <Upload className="mx-auto h-16 w-16 text-blue-500 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Customer Support QA Analysis
          </h1>
          <p className="text-gray-600 mb-6">
            Upload your QA results CSV file to get comprehensive analysis and insights
          </p>
          <label className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
            <Upload className="mr-2 h-5 w-5" />
            Upload CSV File
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>
    );
  }

  if (!analysisData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600">Processing your data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">QA Analysis Dashboard</h1>
              <p className="text-gray-600 mt-2">
                Analyzing {analysisData?.team.totalConversations} conversations
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={downloadMarkdown}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="mr-2 h-4 w-4" />
                Download Report
              </button>
              <button
                onClick={generateShareableLink}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Share2 className="mr-2 h-4 w-4" />
                Share Analysis
              </button>
            </div>
          </div>
          {shareableId && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                ✅ Current page URL copied to clipboard! Note: Recipients will need to upload the same CSV file to view the analysis.
              </p>
            </div>
          )}
        </div>

        {/* Team Overview */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <TrendingUp className="mr-3 h-6 w-6 text-blue-600" />
            Team Overview
          </h2>
          
          {/* Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-lg">
              <h3 className="text-sm font-medium opacity-90">Team Avg QA Score</h3>
              <p className="text-2xl font-bold">{analysisData.team.avgScore}/100</p>
            </div>
            <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-lg">
              <h3 className="text-sm font-medium opacity-90">Writing Style</h3>
              <p className="text-2xl font-bold">{analysisData.team.avgWriting}/3</p>
            </div>
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-4 rounded-lg">
              <h3 className="text-sm font-medium opacity-90">Accuracy</h3>
              <p className="text-2xl font-bold">{analysisData.team.avgAccuracy}/3</p>
            </div>
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4 rounded-lg">
              <h3 className="text-sm font-medium opacity-90">Empathy & Helpfulness</h3>
              <p className="text-2xl font-bold">{analysisData.team.avgEmpathy}/3</p>
            </div>
          </div>

          {/* Feedback Distribution Chart */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Feedback Distribution</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analysisData.feedbackData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Per-Agent Analysis */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <User className="mr-3 h-6 w-6 text-blue-600" />
            Per-Agent Analysis
          </h2>
          
          <div className="space-y-6">
            {analysisData.agents.map((agent, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">{agent.name}</h3>
                  <span className="text-sm text-gray-500">
                    {agent.totalConversations} conversations
                  </span>
                </div>

                {/* Agent Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600">QA Score</p>
                    <p className="text-lg font-bold text-blue-600">{agent.avgScore}/100</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-sm text-gray-600">Writing</p>
                    <p className="text-lg font-bold text-green-600">{agent.avgWriting}/3</p>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <p className="text-sm text-gray-600">Accuracy</p>
                    <p className="text-lg font-bold text-purple-600">{agent.avgAccuracy}/3</p>
                  </div>
                  <div className="text-center p-3 bg-orange-50 rounded-lg">
                    <p className="text-sm text-gray-600">Empathy</p>
                    <p className="text-lg font-bold text-orange-600">{agent.avgEmpathy}/3</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Good Wins */}
                  {agent.goodWins.length > 0 && (
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-green-800 mb-2 flex items-center">
                        <Award className="mr-2 h-4 w-4" />
                        ✅ Good Wins ({agent.excellentCount} excellent)
                      </h4>
                      <ul className="text-sm text-green-700 space-y-1">
                        {agent.goodWins.map((win, i) => (
                          <li key={i} className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>{win}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recommendations */}
                  {agent.recommendations.length > 0 && (
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-orange-800 mb-2 flex items-center">
                        <AlertTriangle className="mr-2 h-4 w-4" />
                        ⚠️ Recommendations ({agent.improvementCount} need attention)
                      </h4>
                      <ul className="text-sm text-orange-700 space-y-1">
                        {agent.recommendations.map((rec, i) => (
                          <li key={i} className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QAAnalysisApp;