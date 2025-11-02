const express = require('express');
const PDFDocument = require('pdfkit');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

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

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margins: {
        top: 50,
        bottom: 50,
        left: 50,
        right: 50
      }
    });

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="LeetCode_${date?.replace(/[^a-zA-Z0-9]/g, '_') || 'Daily'}.pdf"`);

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
      doc.fontSize(fontSize)
         .fillColor('#333333')
         .text(text, { align: 'justify' })
         .moveDown(0.3);
    };

    const addCode = (text) => {
      doc.fontSize(9)
         .fillColor('#000000')
         .font('Courier')
         .text(text, {
           indent: 20,
           width: doc.page.width - 120
         })
         .font('Helvetica')
         .moveDown(0.5);
    };

    const addLine = () => {
      doc.moveTo(50, doc.y)
         .lineTo(doc.page.width - 50, doc.y)
         .strokeColor('#dddddd')
         .stroke()
         .moveDown(0.5);
    };

    // Build PDF content
    // Header
    addTitle('🚀 LeetCode Daily Challenge', 24, '#1a73e8');
    
    if (date) {
      doc.fontSize(12).fillColor('#666666').text(date, { align: 'center' }).moveDown(1);
    }

    addLine();

    // Problem Title
    addHeading(`📌 ${problemTitle}`, 20, '#1a73e8');

    // Metadata box
    doc.rect(50, doc.y, doc.page.width - 100, 80)
       .fillAndStroke('#f8f9fa', '#dddddd');
    
    doc.y += 15;
    
    if (problemDifficulty) {
      doc.fontSize(11).fillColor('#333333').text(`Difficulty: ${problemDifficulty}`, 65).moveDown(0.2);
    }
    
    if (problemTopics) {
      doc.fontSize(11).fillColor('#333333').text(`Topics: ${problemTopics}`, 65).moveDown(0.2);
    }
    
    if (problemLink) {
      doc.fontSize(11).fillColor('#1a73e8').text(`Link: ${problemLink}`, 65, doc.y, {
        link: problemLink,
        underline: true
      });
    }
    
    doc.y += 20;
    doc.moveDown(1);

    // Problem Description
    if (problemContent) {
      addSubHeading('Problem Description');
      addBody(problemContent.substring(0, 1500));
      doc.addPage();
    }

    // Analysis Section
    addHeading('📚 Comprehensive Analysis & Solutions', 18, '#34a853');
    doc.moveDown(0.5);

    // Parse and render analysis
    const lines = analysis.split('\n');
    let inCodeBlock = false;
    let codeBuffer = '';

    for (let line of lines) {
      // Check if we need a new page
      if (doc.y > doc.page.height - 100) {
        doc.addPage();
      }

      line = line.trim();

      // Handle code blocks
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          // End of code block
          if (codeBuffer) {
            addCode(codeBuffer);
            codeBuffer = '';
          }
          inCodeBlock = false;
        } else {
          // Start of code block
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        codeBuffer += line + '\n';
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
      } else if (line === '') {
        doc.moveDown(0.3);
      } else {
        // Regular text
        addBody(line);
      }
    }

    // Footer
    doc.addPage();
    doc.y = doc.page.height - 150;
    addLine();
    doc.fontSize(16).fillColor('#1a73e8').text('Happy Coding! 💪', { align: 'center' });
    doc.fontSize(12).fillColor('#666666').text('Keep building that DSA muscle memory! 🎯', { align: 'center' });

    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ 
      error: 'Failed to generate PDF', 
      message: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 PDF Generator Service running on port ${PORT}`);
  console.log(`📄 API Endpoint: http://localhost:${PORT}/generate-pdf`);
  console.log(`💚 Health Check: http://localhost:${PORT}/health`);
});