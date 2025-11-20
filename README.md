# Docx Converter

A powerful React-based application for converting DOCX documents to various formats, with special support for WordPress Gutenberg blocks.

## 🌟 Features

### Document Conversion
- **DOCX to HTML**: Convert Microsoft Word documents to clean HTML
- **DOCX to WordPress Gutenberg**: Convert to WordPress block format
- **Text Format Conversion**: Support for BBCode, SCSS, and other formats
- **Image Processing**: Built-in image resizing capabilities

### Advanced Processing
- **Smart Content Detection**: Automatically detects and formats special content
- **Read More Links**: Converts "อ่านบทความเพิ่มเติม" and related phrases to WordPress paragraph blocks
- **Table Conversion**: Transforms Word tables to WordPress table blocks
- **List Processing**: Handles ordered and unordered lists
- **YouTube Integration**: Detects and converts YouTube links to WordPress embed blocks

### WordPress Gutenberg Support
- **Heading Conversion**: Automatic heading hierarchy (H1-H6)
- **Paragraph Blocks**: Clean paragraph formatting with class support
- **Image Blocks**: WordPress-compatible image blocks with alt text
- **Table Blocks**: Responsive table formatting
- **Custom Classes**: Support for custom CSS classes like `vsq-readmore`

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone https://github.com/tanakrons-droid/Docx-Converter.git
cd Docx-Converter
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

4. Open your browser and navigate to `http://localhost:3000`

## 📖 Usage

### Basic Document Conversion

1. **Upload DOCX File**: Click the upload area or drag and drop your DOCX file
2. **Choose Conversion Type**: Select from available conversion options:
   - HTML
   - WordPress Gutenberg Blocks
   - BBCode
   - SCSS
3. **Convert**: Click the convert button to process your document
4. **Download**: Save the converted output to your computer

### WordPress Gutenberg Conversion

The application automatically converts:

- **Headings**: `# Title` → `<!-- wp:heading --><h1>Title</h1><!-- /wp:heading -->`
- **Paragraphs**: Text → `<!-- wp:paragraph --><p>Text</p><!-- /wp:paragraph -->`
- **Images**: Images → `<!-- wp:image --><figure class="wp-block-image">...</figure><!-- /wp:image -->`
- **Tables**: Tables → `<!-- wp:table --><figure class="wp-block-table">...</figure><!-- /wp:table -->`
- **Lists**: Lists → `<!-- wp:list --><ul>...</ul><!-- /wp:list -->`

### Special Features

#### Read More Links
Automatically detects Thai phrases and converts them to WordPress blocks:
- "อ่านบทความเพิ่มเติม" → WordPress paragraph block with `vsq-readmore` class
- "อ่านบทความแนะนำ" → WordPress paragraph block with `vsq-readmore` class
- Preserves original links with proper attributes (`target="_blank"`, `rel="noreferrer noopener"`)

#### Image Processing
- Automatic image resizing
- Alt text preservation
- WordPress-compatible image blocks
- Support for various image formats

#### YouTube Integration
- Automatic YouTube URL detection
- Conversion to WordPress embed blocks
- Support for various YouTube URL formats

## 🛠️ Technology Stack

- **Frontend**: React 18.3.1
- **Document Processing**: Mammoth.js for DOCX parsing
- **File Handling**: FileSaver.js for downloads
- **Archive Support**: JSZip for compressed files
- **Icons**: FontAwesome
- **Routing**: React Router DOM

## 📁 Project Structure

```
src/
├── components/
│   ├── Home.jsx              # Main conversion component
│   ├── Html.jsx              # HTML conversion
│   ├── Bbcode.jsx            # BBCode conversion
│   ├── Scss.jsx              # SCSS conversion
│   └── ImageResize.jsx       # Image processing
├── utils/
│   ├── convertReadMoreLinks.js   # Read more link processing
│   └── ...                   # Other utility functions
└── App.js                    # Main application component
```

## 🔧 Configuration

### Conversion Settings
The application supports various configuration options for:
- Output format customization
- WordPress block attributes
- Image processing parameters
- Text processing rules

### Custom Classes
The converter supports custom CSS classes:
- `vsq-readmore` for read more links
- Custom heading classes with Q&A detection
- Table styling classes

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Guidelines
1. Follow React best practices
2. Maintain clean code structure
3. Test conversion functionality thoroughly
4. Update documentation for new features

### Issue Reporting
When reporting issues, please include:
- Input DOCX file (if possible)
- Expected output
- Actual output
- Browser and version information

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions:
1. Check the existing issues on GitHub
2. Create a new issue with detailed information
3. Provide sample files when possible

## 🔄 Updates and Changelog

### Recent Updates
- Fixed WordPress paragraph block nesting issues
- Improved read more link detection
- Enhanced table conversion
- Better YouTube link processing
- Optimized image handling

### Known Limitations
- Complex Word formatting may require manual adjustment
- Large files may take longer to process
- Some advanced Word features are not supported

## 🎯 Future Enhancements
- Support for more document formats
- Enhanced styling options
- Batch file processing
- Cloud storage integration
- Advanced WordPress block support

---

**Made with ❤️ for seamless document conversion**