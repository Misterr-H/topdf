const express = require('express');
const PDFDocument = require('pdfkit');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Helper function to decode HTML entities
function decodeHtmlEntities(text) {
  const entities = {
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
    '&ndash;': '–',
    '&mdash;': '—',
    '&times;': '×',
    '&divide;': '÷',
    '&le;': '≤',
    '&ge;': '≥',
    '&ne;': '≠',
    '&hellip;': '...',
  };
  
  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  }
  
  // Handle numeric entities
  decoded = decoded.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  return decoded;
}

// Helper function to clean text for PDF
function cleanText(text) {
  if (!text) return '';
  
  // Decode HTML entities first
  text = decodeHtmlEntities(text);
  
  // Remove HTML tags
  text = text.replace(/<[^>]*>/g, '');
  
  // Fix common formatting issues
  text = text.replace(/\r\n/g, '\n');
  text = text.replace(/\r/g, '\n');
  
  // Remove excessive whitespace but preserve intentional line breaks
  text = text.replace(/[ \t]+/g, ' ');
  
  return text.trim();
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'leetcode-pdf-generator' });
});

// PDF generation endpoint
app.post('/generate-pdf', (req, res) => {
  try {
    const {
      problemTitle,
      problemDifficulty,
      problemTopics,
      problemLink,
      problemContent,
      analysis,
      date
    } = req.body;

    // Validate required fields
    if (!problemTitle || !analysis) {
      return res.status(400).json({ 
        error: 'Missing required fields: problemTitle and analysis are required' 
      });
    }

    // Clean all text inputs
    const cleanedTitle = cleanText(problemTitle);
    const cleanedDifficulty = cleanText(problemDifficulty || '');
    const cleanedTopics = cleanText(problemTopics || '');
    const cleanedContent = cleanText(problemContent || '');
    const cleanedAnalysis = cleanText(analysis);

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margins: {
        top: 50,
        bottom: 50,
        left: 50,
        right: 50
      },
      bufferPages: true
    });

    // Set response headers for PDF download
    const filename = `LeetCode_${date?.replace(/[^a-zA-Z0-9]/g, '_') || 'Daily'}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Helper functions for styling
    const addTitle = (text, fontSize = 24, color = '#1a73e8') => {
      doc.fontSize(fontSize)
         .fillColor(color)
         .text(text, { align: 'center' })
         .moveDown(0.5);
    };

    const addHeading = (text, fontSize = 18, color = '#34a853') => {
      doc.fontSize(fontSize)
         .fillColor(color)
         .text(text)
         .moveDown(0.3);
    };

    const addSubHeading = (text, fontSize = 14, color = '#ea4335') => {
      doc.fontSize(fontSize)
         .fillColor(color)
         .text(text)
         .moveDown(0.2);
    };

    const addBody = (text, fontSize = 11) => {
      if (!text) return;
      doc.fontSize(fontSize)
         .fillColor('#333333')
         .text(text, { align: 'justify', width: doc.page.width - 100 })
         .moveDown(0.3);
    };

    const addCode = (text) => {
      if (!text) return;
      doc.fontSize(9)
         .fillColor('#000000')
         .font('Courier')
         .text(text, {
           indent: 20,
           width: doc.page.width - 120,
           align: 'left'
         })
         .font('Helvetica')
         .moveDown(0.5);
    };

    const addLine = () => {
      const y = doc.y;
      doc.moveTo(50, y)
         .lineTo(doc.page.width - 50, y)
         .strokeColor('#dddddd')
         .lineWidth(1)
         .stroke()
         .moveDown(0.5);
    };

    const checkPageBreak = (spaceNeeded = 100) => {
      if (doc.y > doc.page.height - spaceNeeded) {
        doc.addPage();
        return true;
      }
      return false;
    };

    // Build PDF content
    // Header
    addTitle('🚀 LeetCode Daily Challenge', 24, '#1a73e8');
    
    if (date) {
      doc.fontSize(12).fillColor('#666666').text(date, { align: 'center' }).moveDown(1);
    }

    addLine();

    // Problem Title
    addHeading(`📌 ${cleanedTitle}`, 20, '#1a73e8');

    // Metadata box
    const boxY = doc.y;
    doc.rect(50, boxY, doc.page.width - 100, 80)
       .fillAndStroke('#f8f9fa', '#dddddd');
    
    doc.y = boxY + 15;
    
    if (cleanedDifficulty) {
      doc.fontSize(11).fillColor('#333333').text(`Difficulty: ${cleanedDifficulty}`, 65).moveDown(0.2);
    }
    
    if (cleanedTopics) {
      doc.fontSize(11).fillColor('#333333').text(`Topics: ${cleanedTopics}`, 65).moveDown(0.2);
    }
    
    if (problemLink) {
      doc.fontSize(11).fillColor('#1a73e8').text(`Link: ${problemLink}`, 65, doc.y, {
        link: problemLink,
        underline: true
      });
    }
    
    doc.y = boxY + 95;
    doc.moveDown(0.5);

    // Problem Description
    if (cleanedContent) {
      checkPageBreak(150);
      addSubHeading('Problem Description');
      
      // Split content into paragraphs and handle long text
      const contentLines = cleanedContent.split('\n');
      for (const line of contentLines) {
        if (line.trim()) {
          checkPageBreak(80);
          addBody(line.substring(0, 1000)); // Limit each paragraph
        }
      }
      
      doc.addPage();
    }

    // Analysis Section
    addHeading('📚 Comprehensive Analysis & Solutions', 18, '#34a853');
    doc.moveDown(0.5);

    // Parse and render analysis
    const lines = cleanedAnalysis.split('\n');
    let inCodeBlock = false;
    let codeBuffer = '';
    let codeLanguage = '';

    for (let i = 0; i < lines.length; i++) {
      checkPageBreak(100);
      
      let line = lines[i];

      // Handle code blocks
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          // End of code block
          if (codeBuffer.trim()) {
            checkPageBreak(150);
            if (codeLanguage) {
              doc.fontSize(8).fillColor('#666666').text(`[${codeLanguage}]`, { indent: 20 });
            }
            addCode(codeBuffer.trim());
            codeBuffer = '';
            codeLanguage = '';
          }
          inCodeBlock = false;
        } else {
          // Start of code block
          inCodeBlock = true;
          codeLanguage = line.trim().substring(3).trim();
        }
        continue;
      }

      if (inCodeBlock) {
        codeBuffer += line + '\n';
        continue;
      }

      line = line.trim();
      if (!line) {
        doc.moveDown(0.2);
        continue;
      }

      // Handle headings
      if (line.startsWith('## ')) {
        doc.moveDown(0.5);
        addHeading(line.substring(3));
      } else if (line.startsWith('### ')) {
        doc.moveDown(0.3);
        addSubHeading(line.substring(4));
      } else if (line.startsWith('# ')) {
        doc.moveDown(0.5);
        addTitle(line.substring(2), 20);
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        // Bullet points
        doc.fontSize(11)
           .fillColor('#333333')
           .text('• ' + line.substring(2), { 
             indent: 20,
             width: doc.page.width - 120 
           });
      } else {
        // Regular text
        addBody(line);
      }
    }

    // Handle any remaining code block
    if (inCodeBlock && codeBuffer.trim()) {
      addCode(codeBuffer.trim());
    }

    // Footer
    if (doc.y < doc.page.height - 200) {
      doc.moveDown(2);
    } else {
      doc.addPage();
    }
    
    doc.y = doc.page.height - 150;
    addLine();
    doc.fontSize(16).fillColor('#1a73e8').text('Happy Coding! 💪', { align: 'center' });
    doc.fontSize(12).fillColor('#666666').text('Keep building that DSA muscle memory! 🎯', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#999999').text(`Generated on ${new Date().toLocaleString()}`, { align: 'center' });

    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error('Error generating PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to generate PDF', 
        message: error.message 
      });
    }
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 PDF Generator Service running on port ${PORT}`);
  console.log(`📄 API Endpoint: http://localhost:${PORT}/generate-pdf`);
  console.log(`💚 Health Check: http://localhost:${PORT}/health`);
});