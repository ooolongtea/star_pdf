import os
import logging
from pathlib import Path
import shutil
import subprocess
import tempfile
from typing import Optional, Tuple, List, Dict, Any
from docx import Document
from docx.oxml import CT_P, CT_Tbl
from docx.oxml.ns import qn
from docx.table import Table
from base_parser import DocumentParser

# 配置日志
logger = logging.getLogger("word_parser")

class WordParser(DocumentParser):
    """本地Word文档解析器，支持.doc和.docx格式"""
    
    def parse(self, file_path: str, output_dir: str) -> Optional[str]:
        """
        解析Word文档（支持.doc和.docx），转换为Markdown
        
        Args:
            file_path: Word文件路径
            output_dir: 输出目录路径
            
        Returns:
            str: 生成的Markdown文件路径，失败时返回None
        """
        try:
            # 输入验证
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"输入文件不存在: {file_path}")
            if os.path.splitext(file_path)[1].lower() not in ('.doc', '.docx'):
                raise ValueError("仅支持 .doc 和 .docx 格式")
                
            # 创建输出目录
            os.makedirs(output_dir, exist_ok=True)
            
            # 获取文件名（不含扩展名）
            file_name = os.path.splitext(os.path.basename(file_path))[0]
            
            # 创建图片目录
            image_dir = os.path.join(output_dir, "images")
            os.makedirs(image_dir, exist_ok=True)
            
            # 统一处理为.docx格式
            docx_path = self._convert_to_docx_if_needed(file_path, output_dir)
            
            # 解析文档内容
            md_path = self._parse_docx_content(docx_path, output_dir, image_dir, file_name)
            
            # 复制原始文件到输出目录
            orig_file_ext = os.path.splitext(file_path)[1]
            orig_file_dest = os.path.join(output_dir, f"{file_name}{orig_file_ext}")
            shutil.copy2(file_path, orig_file_dest)
            logger.info(f"已复制原始文件: {orig_file_dest}")
            
            # 清理临时文件
            if docx_path != file_path and os.path.exists(docx_path):
                os.remove(docx_path)
                logger.debug(f"已删除临时文件: {docx_path}")
            
            return md_path
            
        except Exception as e:
            logger.error(f"Word解析失败: {str(e)}")
            return None

    def _convert_to_docx_if_needed(self, file_path: str, output_dir: str) -> str:
        """将.doc转换为.docx（如需要）"""
        if file_path.lower().endswith('.docx'):
            return file_path
            
        # 创建临时目录用于转换
        temp_dir = tempfile.mkdtemp()
        try:
            output_path = os.path.join(temp_dir, os.path.basename(file_path).split(".")[0] + '.docx')
            
            try:
                subprocess.run([
                    "soffice", "--headless", "--convert-to", "docx",
                    "--outdir", temp_dir, file_path
                ], check=True, timeout=30)
                logger.info(f"已转换.doc到.docx: {output_path}")
                return output_path
            except subprocess.TimeoutExpired:
                raise RuntimeError("文档转换超时，请确保已安装LibreOffice")
            except Exception as e:
                raise RuntimeError(f"文档转换失败: {str(e)}")
        except Exception as e:
            logger.error(f"转换文档失败: {str(e)}")
            shutil.rmtree(temp_dir, ignore_errors=True)
            raise
            
    def _parse_docx_content(self, file_path: str, output_dir: str, image_dir: str, file_name: str) -> str:
        """解析.docx文档内容"""
        doc = Document(file_path)
        md_lines = []
        image_counter = 1

        for element in doc.element.body:
            if isinstance(element, CT_P):  # 段落处理
                paragraph_text = self._get_paragraph_text(element)
                if paragraph_text:
                    md_lines.append(self._format_paragraph(element, paragraph_text))
                
                # 图片处理
                image_counter = self._process_images(element, doc, image_dir, image_counter, md_lines)
                
            elif isinstance(element, CT_Tbl):  # 表格处理
                md_lines.extend(self._process_table(element, doc))

        # 保存Markdown文件
        md_path = os.path.join(output_dir, f"{file_name}.md")
        with open(md_path, "w", encoding="utf-8") as f:
            f.writelines(md_lines)
            
        logger.info(f"Markdown文件已生成: {md_path}")
        return md_path

    def _get_paragraph_text(self, element) -> str:
        """获取段落文本"""
        return element.text.strip()

    def _format_paragraph(self, element, text: str) -> str:
        """格式化段落为Markdown"""
        style = element.get("style", "")
        if "Heading" in style:
            level = int(style.replace("Heading ", ""))
            return f"{'#' * level} {text}\n\n"
        return f"{text}\n\n"

    def _process_images(self, element, doc, image_dir: str, counter: int, md_lines: List[str]) -> int:
        """处理段落中的图片"""
        for run in element.r_lst:
            blip = run.find(".//a:blip", namespaces={
                "a": "http://schemas.openxmlformats.org/drawingml/2006/main"
            })
            if blip is not None:
                image_path = self._save_image(doc, blip, image_dir, counter)
                relative_path = os.path.join("images", os.path.basename(image_path))
                md_lines.append(f"![Image]({relative_path})\n\n")
                counter += 1
        return counter

    def _save_image(self, doc, blip, image_dir: str, counter: int) -> str:
        """保存图片到本地"""
        image_rel = blip.get(qn("r:embed"))
        image_part = doc.part.rels[image_rel].target_part
        image_ext = self._get_image_extension(image_part.content_type)
        image_path = os.path.join(image_dir, f"image_{counter}{image_ext}")
        
        with open(image_path, "wb") as f:
            f.write(image_part.blob)
            
        return image_path

    def _get_image_extension(self, content_type: str) -> str:
        """获取图片扩展名"""
        return {
            "image/png": ".png",
            "image/jpeg": ".jpg",
            "image/gif": ".gif",
            "image/bmp": ".bmp",
            "image/svg+xml": ".svg"
        }.get(content_type, ".png")

    def _process_table(self, element, doc) -> List[str]:
        """处理表格为Markdown格式"""
        table_lines = []
        # 通过docx库的Table对象处理
        for table in doc.tables:
            table_lines.append("\n")  # 表格前空行
            
            # 表头
            headers = [cell.text.strip() for cell in table.rows[0].cells]
            table_lines.append("| " + " | ".join(headers) + " |\n")
            table_lines.append("|" + " | ".join(["---"] * len(headers)) + "|\n")
            
            # 表格内容
            for row in table.rows[1:]:  # 跳过表头行
                row_data = [cell.text.strip() for cell in row.cells]
                table_lines.append("| " + " | ".join(row_data) + " |\n")
            
            table_lines.append("\n")  # 表格后空行
            
        return table_lines


class OnlineWordParser(DocumentParser):
    """
    在线Word文档解析器
    实现与远程服务器接口兼容的Word文档解析功能
    简化输出结构，只保留原文件和转换后的MD文件
    """
    
    def __init__(self):
        super().__init__()
        self.local_parser = WordParser()
        logger.info("初始化在线Word解析器 (简化版)")
    
    def parse(self, 
             file_bytes: bytes, 
             filename: str,
             output_dir: Path, 
             opts: Dict[str, Any]) -> Optional[Path]:
        """
        解析Word文档并生成Markdown
        
        Args:
            file_bytes: 字节流形式的Word文件内容
            filename: 原始文件名（带扩展名）
            output_dir: 结构化输出目录
            opts: 附加选项字典
        
        Returns:
            Path: 成功时返回生成的Markdown文件Path对象，失败时返回None
        """
        logger.info(f"开始解析Word文档: {filename}")
        request_id = opts.get('request_id', Path(filename).stem)
        
        # 创建请求专属目录
        request_dir = output_dir / request_id
        auto_dir = request_dir / 'auto'
        os.makedirs(auto_dir, exist_ok=True)
        
        temp_path = None
        try:
            # 创建带正确后缀的临时文件
            suffix = Path(filename).suffix  # 保留原始扩展名(.doc/.docx)
            with tempfile.NamedTemporaryFile(
                mode='wb',
                suffix=suffix,
                delete=False
            ) as tmp_file:
                tmp_file.write(file_bytes)
                temp_path = Path(tmp_file.name)
            
            logger.info(f"临时文件已创建: {temp_path}")

            # 调用本地解析器
            md_path_str = self.local_parser.parse(
                str(temp_path),    # 本地解析器需要字符串路径
                str(auto_dir)      # 使用auto子目录
            )

            # 验证输出结果
            if md_path_str:
                md_path = Path(md_path_str)
                if md_path.exists() and md_path.stat().st_size > 0:
                    # 创建与请求ID同名的Markdown文件
                    final_md_path = auto_dir / f"{request_id}.md"
                    
                    # 如果生成的文件名与请求ID不同，重命名文件
                    if md_path.name != final_md_path.name:
                        shutil.copy2(md_path, final_md_path)
                        logger.info(f"已复制Markdown文件: {md_path} -> {final_md_path}")
                        
                        # 删除原始MD文件
                        md_path.unlink()
                        logger.debug(f"已删除原始Markdown文件: {md_path}")
                    
                    # 保存原始文件
                    orig_file_path = auto_dir / filename
                    with open(orig_file_path, 'wb') as f:
                        f.write(file_bytes)
                    logger.info(f"已保存原始文件: {orig_file_path}")
                    
                    logger.info(f"Word解析完成，输出文件: {final_md_path}")
                    return final_md_path
            
            logger.error("Word解析失败，未生成有效的Markdown文件")
            return None

        except Exception as e:
            logger.error(f"Word解析异常: {str(e)}")
            raise RuntimeError(f"Word解析失败: {str(e)}") from e
        finally:
            # 确保清理临时文件
            if temp_path and temp_path.exists():
                try:
                    temp_path.unlink()
                    logger.debug(f"临时文件已清理: {temp_path}")
                except Exception as cleanup_e:
                    logger.warning(f"临时文件清理失败: {str(cleanup_e)}")


if __name__ == "__main__":
    # 配置控制台日志
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # 测试本地解析
    input_path = "/path/to/test/document.docx"
    output_path = "/path/to/output"
    
    if os.path.exists(input_path):
        wordparser = WordParser()
        result = wordparser.parse(input_path, output_path)
        print(f"解析结果: {result}")
    else:
        print(f"测试文件不存在: {input_path}")
