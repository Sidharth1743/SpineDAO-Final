import os
import sys
from dotenv import load_dotenv
from agentic_doc.parse import parse_documents

def main():
    # Disable color output and redirect stderr to devnull
    os.environ['NO_COLOR'] = '1'
    os.environ['FORCE_COLOR'] = '0'
    stderr = sys.stderr
    sys.stderr = open(os.devnull, 'w')
    
    try:
        # Load environment variables
        load_dotenv()
        api_key = os.getenv("VISION_AGENT_API_KEY")
        if not api_key:
            print("Error: VISION_AGENT_API_KEY must be set in .env file")
            sys.exit(1)

        # Get PDF path from command line argument
        if len(sys.argv) < 2:
            print("Error: PDF path not provided")
            sys.exit(1)
        
        pdf_path = sys.argv[1]
        if not os.path.exists(pdf_path):
            print(f"Error: PDF file not found: {pdf_path}")
            sys.exit(1)

        # Create digitized directory if it doesn't exist
        digitized_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'digitized')
        os.makedirs(digitized_dir, exist_ok=True)

        # Generate output filename based on input PDF name
        pdf_name = os.path.basename(pdf_path)
        base_name = os.path.splitext(pdf_name)[0]
        output_file = os.path.join(digitized_dir, f"{base_name}-digitized.txt")

        # Parse document and get raw text
        result = parse_documents([pdf_path])[0]
        raw_text = "\n".join(chunk.text for chunk in result.chunks if hasattr(chunk, 'text'))

        # Write raw text to file
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(raw_text)

        # Print ONLY the output file path with a newline
        print(f"\n{output_file}")
        
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)
    finally:
        # Restore stderr
        sys.stderr.close()
        sys.stderr = stderr

if __name__ == "__main__":
    main()