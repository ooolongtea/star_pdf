import os
import uuid
import shutil
import tempfile
import gc
import fitz
import torch
import base64
import filetype
import litserve as ls
import logging
from pathlib import Path
from fastapi import HTTPException, FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, Optional, Union

# 导入自定义解析器
from word_parser import OnlineWordParser
from excel_parser import OnlineExcelParser

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("mineru_server.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("mineru_server")

# 请求模型
class PredictRequest(BaseModel):
    file: str
    kwargs: Optional[Dict[str, Any]] = {}
    request_id: Optional[str] = None  # 客户端可以提供请求ID用于跟踪

class MinerUAPI(ls.LitAPI):
    def __init__(self, output_dir='/home/zhangxiaohong/zhouxingyu/zxy_extractor/data/tmp/mineru'):
        # 确保使用绝对路径
        self.output_dir = Path(os.path.abspath(output_dir))
        if not self.output_dir.exists():
            self.output_dir.mkdir(parents=True, exist_ok=True)

        # 初始化文档解析器
        self.word_parser = OnlineWordParser()
        self.excel_parser = OnlineExcelParser()

        logger.info(f"初始化 MinerUAPI，输出目录: {self.output_dir}")

    def setup(self, device):
        if device.startswith('cuda'):
            os.environ['CUDA_VISIBLE_DEVICES'] = device.split(':')[-1]
            if torch.cuda.device_count() > 1:
                raise RuntimeError("Remove any CUDA actions before setting 'CUDA_VISIBLE_DEVICES'.")

        try:
            from magic_pdf.tools.cli import do_parse, convert_file_to_pdf
            from magic_pdf.model.doc_analyze_by_custom_model import ModelSingleton

            self.do_parse = do_parse
            self.convert_file_to_pdf = convert_file_to_pdf

            model_manager = ModelSingleton()
            model_manager.get_model(True, False)
            model_manager.get_model(False, False)
            logger.info(f'模型初始化完成，设备: {device}')
        except ImportError as e:
            logger.error(f"导入 magic_pdf 模块错误: {str(e)}")
            # 尝试其他导入方式
            try:
                # 尝试从 magic_pdf.parser 导入
                from magic_pdf.parser import MagicPDF
                logger.info("从 magic_pdf.parser 导入 MagicPDF")
                # 这里需要适配不同的导入方式
            except ImportError:
                logger.error("无法导入 magic_pdf 模块，请检查安装")
                raise

    def decode_request(self, request):
        """
        解码请求数据

        Args:
            request: 客户端请求数据

        Returns:
            tuple: (request_id, file_bytes, opts, is_direct_markdown)
                - request_id: 请求ID
                - file_bytes: 文件字节内容（可能为None，如果是直接处理为Markdown的文件）
                - opts: 处理选项
                - is_direct_markdown: 是否直接处理为Markdown（不需要PDF转换）
        """
        file_base64 = request['file']
        request_id = request.get('request_id', str(uuid.uuid4()))

        logger.info(f"收到请求: {request_id}")

        # 获取处理选项
        opts = request.get('kwargs', {})
        opts.setdefault('debug_able', False)
        opts.setdefault('parse_method', 'auto')
        opts.setdefault('f_dump_middle_json', False)
        opts.setdefault('f_dump_model_json', False)
        opts.setdefault('f_dump_orig_pdf', True)
        opts.setdefault('f_dump_content_list', False)
        opts.setdefault('f_draw_model_bbox', False)
        opts.setdefault('f_draw_layout_bbox', False)
        opts.setdefault('f_draw_span_bbox', False)
        opts.setdefault('f_draw_line_sort_bbox', False)
        opts.setdefault('f_draw_char_bbox', False)

        # 添加请求ID到选项中，供解析器使用
        opts['request_id'] = request_id

        logger.info(f"请求 {request_id} 的处理选项: {opts}")

        # 转换文件为PDF或直接处理为Markdown
        file_bytes = self.cvt2pdf(file_base64, request_id)

        # 判断是否直接处理为Markdown（file_bytes为None表示已直接处理）
        is_direct_markdown = file_bytes is None

        return request_id, file_bytes, opts, is_direct_markdown

    def predict(self, inputs):
        """
        处理请求

        Args:
            inputs: 解码后的请求数据

        Returns:
            dict: 处理结果
        """
        # 解包输入
        if len(inputs) == 4:
            request_id, file_bytes, opts, is_direct_markdown = inputs
        else:
            # 兼容旧版本接口
            request_id, file_bytes, opts = inputs
            is_direct_markdown = False

        output_dir = self.output_dir.joinpath(request_id)

        try:
            logger.info(f"开始处理请求: {request_id}")

            # 如果是直接处理为Markdown的文件类型（如Word、Excel），跳过PDF处理
            if is_direct_markdown:
                logger.info(f"文件已直接处理为Markdown: {request_id}")
            else:
                # 使用PDF处理流程
                if file_bytes:
                    self.do_parse(self.output_dir, request_id, file_bytes, [], **opts)
                else:
                    logger.error(f"文件内容为空: {request_id}")
                    raise ValueError("文件内容为空")

            # 检查输出目录
            auto_dir = output_dir / 'auto'
            if auto_dir.exists():
                logger.info(f"输出目录存在: {auto_dir}")

                # 检查Markdown文件是否存在
                md_file = auto_dir / f"{request_id}.md"
                if md_file.exists():
                    logger.info(f"Markdown文件存在: {md_file}")
                else:
                    logger.warning(f"Markdown文件不存在: {md_file}")

                    # 列出目录中的所有文件
                    logger.info(f"目录内容: {list(auto_dir.glob('*'))}")
            else:
                logger.warning(f"输出目录不存在: {auto_dir}")

            logger.info(f"请求处理完成: {request_id}, 输出目录: {output_dir}")
            return {'request_id': request_id, 'output_dir': str(output_dir)}
        except Exception as e:
            logger.error(f"请求处理错误: {request_id}, 错误: {str(e)}")
            # 不要删除输出目录，以便于调试
            # shutil.rmtree(output_dir, ignore_errors=True)
            raise HTTPException(status_code=500, detail=str(e))
        finally:
            self.clean_memory()

    def encode_response(self, response):
        return response

    def clean_memory(self):
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.ipc_collect()
        gc.collect()

    def cvt2pdf(self, file_base64, request_id=None):
        """
        将文件转换为PDF或处理为Markdown

        Args:
            file_base64: Base64编码的文件内容
            request_id: 请求ID，用于创建输出目录

        Returns:
            bytes: PDF文件内容或None（如果是直接处理为Markdown的文件类型）
        """
        temp_dir = Path(tempfile.mkdtemp())
        temp_file = temp_dir.joinpath('tmpfile')

        try:
            # 解码文件内容
            file_bytes = base64.b64decode(file_base64)

            # 检测文件类型
            file_ext = filetype.guess_extension(file_bytes)
            if not file_ext and temp_file.suffix:
                # 如果无法检测到类型，尝试使用文件后缀
                file_ext = temp_file.suffix.lstrip('.')

            logger.info(f"检测到文件类型: {file_ext}")

            # 根据文件类型进行处理
            if file_ext == 'pdf':
                # PDF文件直接返回
                return file_bytes

            elif file_ext in ['jpg', 'png', 'jpeg', 'gif']:
                # 图片文件转换为PDF
                with fitz.open(stream=file_bytes, filetype=file_ext) as f:
                    return f.convert_to_pdf()

            elif file_ext in ['doc', 'docx']:
                # Word文档处理
                if request_id:
                    # 使用自定义解析器直接处理为Markdown
                    output_dir = self.output_dir
                    filename = f"document.{file_ext}"
                    opts = {'request_id': request_id}

                    # 调用Word解析器
                    self.word_parser.parse(file_bytes, filename, output_dir, opts)
                    return None  # 不返回PDF内容，因为已经直接处理为Markdown
                else:
                    # 如果没有请求ID，使用传统方式转换为PDF
                    temp_file.write_bytes(file_bytes)
                    self.convert_file_to_pdf(temp_file, temp_dir)
                    return temp_file.with_suffix('.pdf').read_bytes()

            elif file_ext in ['xls', 'xlsx']:
                # Excel文档处理
                if request_id:
                    # 使用自定义解析器直接处理为Markdown
                    output_dir = self.output_dir
                    filename = f"spreadsheet.{file_ext}"
                    opts = {'request_id': request_id}

                    # 调用Excel解析器
                    self.excel_parser.parse(file_bytes, filename, output_dir, opts)
                    return None  # 不返回PDF内容，因为已经直接处理为Markdown
                else:
                    # 如果没有请求ID，尝试转换为PDF（可能不完美）
                    temp_file.write_bytes(file_bytes)
                    self.convert_file_to_pdf(temp_file, temp_dir)
                    return temp_file.with_suffix('.pdf').read_bytes()

            elif file_ext in ['ppt', 'pptx']:
                # PowerPoint文档转换为PDF
                temp_file.write_bytes(file_bytes)
                self.convert_file_to_pdf(temp_file, temp_dir)
                return temp_file.with_suffix('.pdf').read_bytes()

            else:
                # 不支持的文件格式
                raise Exception(f'不支持的文件格式: {file_ext}')

        except Exception as e:
            logger.error(f"文件转换错误: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

        finally:
            # 清理临时目录
            shutil.rmtree(temp_dir, ignore_errors=True)

# 创建FastAPI应用
app = FastAPI(title="Simplified MinerU Server")

# 添加CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 创建MinerUAPI实例
OUTPUT_DIR = os.environ.get('MINERU_OUTPUT_DIR', '/home/zhangxiaohong/zhouxingyu/zxy_extractor/data/tmp/mineru')
# 确保使用绝对路径
OUTPUT_DIR = os.path.abspath(OUTPUT_DIR)
mineru_api = MinerUAPI(output_dir=OUTPUT_DIR)

# 主函数
if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Simplified MinerU Server')
    parser.add_argument('--port', type=int, default=8010, help='服务器端口')
    parser.add_argument('--host', type=str, default='0.0.0.0', help='服务器主机')
    parser.add_argument('--output-dir', type=str, default='/home/zhangxiaohong/zhouxingyu/zxy_extractor/data/tmp/mineru', help='输出目录')

    args = parser.parse_args()

    # 更新输出目录
    OUTPUT_DIR = os.path.abspath(args.output_dir)
    os.environ['MINERU_OUTPUT_DIR'] = OUTPUT_DIR
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 创建LitServer
    server = ls.LitServer(
        mineru_api,
        accelerator='cuda',
        devices=[0,1],
        workers_per_device=2,
        timeout=False
    )

    # 检查路由
    @server.app.get("/ping")
    async def ping():
        return {"status": "ok", "message": "MinerU 服务器正在运行"}

    @server.app.get("/files")
    async def get_file(path: str):
        try:
            file_path = Path(path)
            if not file_path.exists():
                # 记录详细的文件路径信息，便于调试
                logger.error(f"文件不存在: {path}")
                logger.error(f"绝对路径: {os.path.abspath(path)}")
                logger.error(f"当前工作目录: {os.getcwd()}")

                # 尝试查找文件的其他可能位置
                if '/auto/' in path or '\\auto\\' in path:
                    # 尝试在父目录中查找
                    parent_path = str(file_path).replace('/auto/', '/').replace('\\auto\\', '\\')
                    parent_file_path = Path(parent_path)
                    if parent_file_path.exists():
                        logger.info(f"找到替代文件: {parent_file_path}")
                        return FileResponse(path=parent_file_path)

                # 尝试在 auto 目录中查找
                if not '/auto/' in path and not '\\auto\\' in path:
                    # 提取请求ID
                    parts = path.split('/')
                    if len(parts) > 0:
                        file_name = parts[-1]
                        dir_path = '/'.join(parts[:-1])

                        # 尝试在 auto 目录中查找
                        auto_path = f"{dir_path}/auto/{file_name}"
                        auto_file_path = Path(auto_path)
                        if auto_file_path.exists():
                            logger.info(f"找到替代文件: {auto_file_path}")
                            return FileResponse(path=auto_file_path)

                        # 尝试使用请求ID命名的文件
                        if file_name == 'output.md':
                            # 提取请求ID
                            request_id = parts[-2] if len(parts) > 1 else None
                            if request_id:
                                # 尝试在 auto 目录中查找使用请求ID命名的文件
                                id_path = f"{dir_path}/auto/{request_id}.md"
                                id_file_path = Path(id_path)
                                if id_file_path.exists():
                                    logger.info(f"找到替代文件: {id_file_path}")
                                    return FileResponse(path=id_file_path)

                raise HTTPException(status_code=404, detail=f"文件不存在: {path}")

            if file_path.is_dir():
                logger.error(f"请求的路径是一个目录，而不是文件: {path}")
                raise HTTPException(status_code=400, detail=f"请求的路径是一个目录，而不是文件: {path}")

            return FileResponse(path=file_path)
        except Exception as e:
            logger.error(f"获取文件错误: {str(e)}")
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=500, detail=str(e))

    @server.app.get("/files/list")
    async def list_files(path: str):
        """
        列出目录中的所有文件和子目录

        参数:
            path: 目录路径

        返回:
            包含目录内容的JSON对象
        """
        try:
            dir_path = Path(path)
            if not dir_path.exists():
                logger.error(f"目录不存在: {path}")
                logger.error(f"绝对路径: {os.path.abspath(path)}")
                logger.error(f"当前工作目录: {os.getcwd()}")
                raise HTTPException(status_code=404, detail=f"目录不存在: {path}")

            if not dir_path.is_dir():
                logger.error(f"路径不是目录: {path}")
                raise HTTPException(status_code=400, detail=f"路径不是目录: {path}")

            files = []
            for item in dir_path.iterdir():
                try:
                    stat_info = item.stat()
                    files.append({
                        "name": item.name,
                        "isDirectory": item.is_dir(),
                        "size": stat_info.st_size if item.is_file() else 0,
                        "lastModified": stat_info.st_mtime,
                        "path": str(item.relative_to(dir_path))
                    })
                except Exception as e:
                    logger.error(f"获取文件信息错误: {item}, {str(e)}")
                    # 跳过有问题的文件，继续处理其他文件
                    continue

            return {
                "path": str(dir_path),
                "files": files,
                "total": len(files),
                "directories": sum(1 for f in files if f["isDirectory"]),
                "regularFiles": sum(1 for f in files if not f["isDirectory"])
            }
        except Exception as e:
            logger.error(f"列出目录错误: {str(e)}")
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=500, detail=str(e))

    # 启动服务器
    logger.info(f"启动 Simplified MinerU 服务器，监听 {args.host}:{args.port}")
    server.run(host=args.host, port=args.port)
