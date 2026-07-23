const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

// API: EXPLAIN Query Analyzer
router.post('/explain', async (req, res) => {
    const { query } = req.body;
    if (!query) {
        return res.status(400).json({ status: 'error', message: 'Query is required' });
    }

    try {
        const [plan] = await req.dbPool.query(`EXPLAIN ${query}`);
        
        let hasTableScan = false;
        let recommendations = [];
        let explanation = "";
        let optimizedQuery = null;

        // Attempt AI Analysis if key is available
        if (process.env.GEMINI_API_KEY) {
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
                const prompt = `You are an expert MySQL Database Administrator. Analyze the following MySQL query and its EXPLAIN execution plan.
Query: ${query}
EXPLAIN Plan: ${JSON.stringify(plan)}

Identify any performance bottlenecks (like full table scans, missing indexes).
Provide a structured JSON response (raw JSON only) with this exact schema:
{
    "hasTableScan": boolean,
    "recommendations": ["string array of actionable indexing/optimizing recommendations"],
    "explanation": "string explaining what the query is doing, why it is fast/slow, and overall health",
    "optimizedQuery": "string containing a rewritten/optimized SQL query based on your recommendations, or null if no optimization is possible"
}`;
                let response;
                let lastAiErr;
                const fallbackModels = ['gemini-flash-latest', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'];
                
                for (const modelName of fallbackModels) {
                    try {
                        response = await ai.models.generateContent({
                            model: modelName,
                            contents: prompt,
                            config: {
                                responseMimeType: "application/json",
                            }
                        });
                        break; // If successful, exit the fallback loop
                    } catch (err) {
                        lastAiErr = err;
                        console.warn(`[GEMINI] Model ${modelName} failed (${err.status || err.message}). Attempting fallback...`);
                        // Only retry if it's a 503 (Unavailable) or 429 (Rate Limit) or 404 (Not Found)
                        if (err.status !== 503 && err.status !== 429 && err.status !== 404) {
                            throw err; 
                        }
                    }
                }

                if (!response) {
                    throw lastAiErr; // If all models in the fallback array failed
                }

                const aiAnalysis = JSON.parse(response.text);
                hasTableScan = aiAnalysis.hasTableScan;
                recommendations = aiAnalysis.recommendations;
                explanation = aiAnalysis.explanation;
                optimizedQuery = aiAnalysis.optimizedQuery;
            } catch (aiErr) {
                console.error("Gemini API Error:", aiErr);
                explanation = "AI Analysis failed. Falling back to rule-based diagnostics.";
            }
        }

        // Fallback to rule-based logic if no recommendations exist
        if (recommendations.length === 0) {
            plan.forEach(step => {
                if (step.type === 'ALL') {
                    hasTableScan = true;
                    recommendations.push(`Warning: Sequential Scan (type: ALL) detected on table '${step.table}'. Consider adding an index on the columns used in the WHERE or JOIN clauses to convert this to 'ref' or 'range'.`);
                }
            });
            if (!explanation) explanation = "Rule-based analysis completed.";
        }

        res.json({
            status: 'success',
            data: {
                plan,
                analysis: {
                    hasTableScan,
                    recommendations,
                    explanation,
                    optimizedQuery
                }
            }
        });
    } catch (error) {
        console.error('EXPLAIN Error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// API: Slow Log Parser
router.get('/slow-log', async (req, res) => {
    try {
        // Force MySQL to write slow logs to the mysql.slow_log table (solves Windows EPERM file issues)
        // Wrapped in try/catch because managed databases like AWS RDS strip SUPER privileges.
        try {
            await req.dbPool.query("SET GLOBAL log_output = 'FILE,TABLE'");
        } catch (setGlobalErr) {
            console.warn("Could not set global log_output (this is normal on AWS RDS). Please configure it via AWS Parameter Groups if slow logs are empty.");
        }

        // Query the slow_log table directly
        const [queries] = await req.dbPool.query(`
            SELECT 
                start_time,
                user_host,
                query_time,
                rows_examined,
                sql_text 
            FROM mysql.slow_log 
            ORDER BY start_time DESC 
            LIMIT 100
        `);

        // Format to match the frontend expectations
        const formatted = queries.map(q => {
            // query_time is usually returned as a TIME string like '00:00:11.000000'
            // We can extract the seconds, or just pass it directly
            let qTimeStr = q.query_time ? q.query_time.toString() : '0';
            
            // Extract the seconds part from HH:MM:SS.mmmmmm
            let seconds = qTimeStr;
            if (qTimeStr.includes(':')) {
                const parts = qTimeStr.split(':');
                seconds = parseFloat(parts[2]).toFixed(2);
            }

            return {
                time: new Date(q.start_time).toLocaleTimeString(),
                userHost: q.user_host instanceof Buffer ? q.user_host.toString('utf8') : q.user_host,
                Query_time: seconds,
                Rows_examined: q.rows_examined,
                query: q.sql_text instanceof Buffer ? q.sql_text.toString('utf8') : q.sql_text
            };
        }).filter(q => q.query && q.query.trim() !== '');

        res.json({ status: 'success', data: formatted });
    } catch (error) {
        console.error('Slow Log Parse Error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

module.exports = router;
