import argparse
import base64
import os
import time
import requests
import numpy as np
from loguru import logger
from joblib import Parallel, delayed
from pathlib import Path
import sys

class FileProcessor:
    # 支持的文件扩展名
    SUPPORTED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.ppt', '.pptx', '.csv', '.xlsx', '.xls', '.xlsm']

    def __init__(self, input_base_path: str, url: str = 'http://127.0.0.1:9898/predict', verbose: int = 0, max_threads: int = 8, **kwargs):
        """
        初始化文件处理器。

        Args:
            input_base_path: 包含待处理文件的根目录。
            url: 预测服务器 URL。
            verbose: Parallel 处理的详细程度。
            max_threads: 最大并行线程数。
            **kwargs: 传递给服务器的其他参数。
        """
        self.input_base_path = Path(input_base_path).resolve()
        self.url = url
        self.verbose = verbose
        self.max_threads = max_threads
        self.kwargs = kwargs

        # 配置日志
        logger.remove()
        logger.add(sys.stderr, level="INFO")
        log_file_path = Path("logs/client_run_cn.log")
        log_file_path.parent.mkdir(parents=True, exist_ok=True)
        try:
             logger.add(log_file_path, rotation="10 MB", level="DEBUG", encoding='utf-8')
             logger.info(f"日志将记录到 (DEBUG+): {log_file_path.resolve()}")
        except Exception as e:
             logger.error(f"配置日志文件失败 {log_file_path}: {e}")
             logger.info("文件日志记录已禁用。")

        logger.info(f"文件处理器已初始化:")
        logger.info(f"  输入根目录: {self.input_base_path}")
        logger.info(f"  服务器 URL: {self.url}")
        logger.info(f"  最大线程数: {self.max_threads}")
        logger.info(f"  附加服务器参数: {self.kwargs}")

        if not self.input_base_path.exists():
             logger.error(f"输入路径不存在: {self.input_base_path}")
             raise FileNotFoundError(f"输入路径不存在: {self.input_base_path}")


    def _to_b64(self, file_path: Path) -> str:
        """文件内容 Base64 编码。"""
        try:
            with open(file_path, 'rb') as f:
                return base64.b64encode(f.read()).decode('utf-8')
        except Exception as e:
            logger.error(f"文件 {file_path} Base64 编码错误: {e}")
            raise

    def _do_parse(self, file_path: Path) -> dict:
        """发送单个文件到服务器进行解析。"""
        filename = file_path.name
        try:
            # 计算相对路径，用于服务器端维持目录结构
            relative_path = file_path.relative_to(self.input_base_path)
            logger.debug(f"处理 {filename} (相对路径: {relative_path})")

            b64_content = self._to_b64(file_path)

            payload = {
                'file': b64_content,
                'filename': filename,
                'relative_path': str(relative_path), # 必须发送相对路径
                'kwargs': self.kwargs
            }

            response = requests.post(self.url, json=payload, timeout=600)
            response.raise_for_status() # 检查 HTTP 错误状态

            output = response.json()
            output['original_file_path'] = str(file_path) # 添加原始路径供参考
            logger.info(f"解析成功: {filename} -> 服务器输出: {output.get('output_dir', 'N/A')}")
            return output

        except requests.exceptions.RequestException as e:
            logger.error(f"文件 {filename} - 网络或服务器错误: {e}")
            if e.response is not None:
                 logger.error(f"服务器响应状态: {e.response.status_code}, 响应体: {e.response.text[:500]}...") # 限制响应体长度
            return {'original_file_path': str(file_path), 'status': 'error', 'error_message': str(e)}
        except Exception as e:
            logger.error(f"文件 {filename} - 本地或其他错误: {e}", exc_info=True)
            return {'original_file_path': str(file_path), 'status': 'error', 'error_message': str(e)}


    def _collect_files(self) -> list[Path]:
        """递归收集所有支持的文件。"""
        if self.input_base_path.is_file():
            if self._is_valid_file(self.input_base_path):
                 logger.info(f"输入为单个有效文件: {self.input_base_path}")
                 return [self.input_base_path]
            else:
                 logger.warning(f"输入文件类型不支持: {self.input_base_path}")
                 return []

        logger.info(f"扫描目录: {self.input_base_path}")
        file_list = [
            item for item in self.input_base_path.rglob('*')
            if item.is_file() and self._is_valid_file(item)
        ]
        logger.info(f"找到 {len(file_list)} 个支持的文件。")
        return file_list

    def _is_valid_file(self, file_path: Path) -> bool:
        """检查文件扩展名是否受支持。"""
        return file_path.suffix.lower() in self.SUPPORTED_EXTENSIONS

    def process(self) -> list[dict]:
        """收集并并行处理文件。"""
        files_to_process = self._collect_files()
        if not files_to_process:
            logger.warning("未找到支持的文件。")
            return []

        n_jobs = int(np.clip(len(files_to_process), 1, self.max_threads))
        logger.info(f"使用 {n_jobs} 个线程处理 {len(files_to_process)} 个文件。")

        start_time = time.time()
        results = Parallel(n_jobs=n_jobs, prefer='threads', verbose=self.verbose)(
            delayed(self._do_parse)(file_path) for file_path in files_to_process
        )
        total_time = time.time() - start_time
        logger.info(f"并行处理完成，耗时 {total_time:.2f} 秒。")

        # 统计成功和失败的数量
        success_count = sum(1 for res in results if isinstance(res, dict) and res.get('status') == 'success')
        error_count = len(results) - success_count
        logger.info(f"处理摘要: 成功 {success_count}, 失败 {error_count}")
        if error_count > 0:
             logger.warning("部分文件处理失败，详情请查看日志。")
             # 可以在日志中打印失败文件的具体信息
             for res in results:
                 if isinstance(res, dict) and res.get('status') == 'error':
                     logger.debug(f"  - 失败: {res.get('original_file_path', '未知')} | 原因: {res.get('error_message', '未知')}")

        return results

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="客户端脚本，用于向服务器发送文件进行处理。")
    parser.add_argument("--input_dir", type=str, default=os.environ.get('INPUT_DIR', "/home/zhangxiaohong/zhouxingyu/zxy_extractor/pdf_parser/data/数学已裁教辅（内部）/数学已裁教辅2/北京西城学习探究诊断初中数学（九年级下册）/北京西城学习探究诊断初中数学（九年级下册）_11-98.pdf"),
                        help="包含待处理文件的根目录 (也可通过环境变量 INPUT_DIR 配置)")
    parser.add_argument("--url", type=str, default=os.environ.get('SERVER_URL', 'http://127.0.0.1:9898/predict'),
                        help="预测服务器 URL (也可通过环境变量 SERVER_URL 配置)")
    parser.add_argument("--max_threads", type=int, default=int(os.environ.get('CLIENT_MAX_THREADS', 32)),
                        help="最大并行线程数 (也可通过环境变量 CLIENT_MAX_THREADS 配置)")
    parser.add_argument("--verbose", type=int, default=int(os.environ.get('CLIENT_VERBOSE', 10)),
                        help="Parallel 处理的详细程度 (也可通过环境变量 CLIENT_VERBOSE 配置)")
    # 可以添加更多的 kwargs 参数，例如 parse_method
    parser.add_argument("--parse_method", type=str, default=os.environ.get('PARSE_METHOD'),
                        help="传递给服务器的 parse_method 参数 (也可通过环境变量 PARSE_METHOD 配置)")
    args = parser.parse_args()

    INPUT_BASE_DIR = args.input_dir
    SERVER_URL = args.url
    MAX_THREADS = args.max_threads
    VERBOSE_LEVEL = args.verbose

    kwargs = {}
    if args.parse_method:
        kwargs['parse_method'] = args.parse_method

    input_path = Path(INPUT_BASE_DIR)
    if not input_path.exists():
        print(f"错误：输入路径不存在: {input_path}")
        print("请使用 --input_dir 参数或设置 INPUT_DIR 环境变量。")
        sys.exit(1)
    if not input_path.is_dir() and not (input_path.is_file() and input_path.suffix.lower() in FileProcessor.SUPPORTED_EXTENSIONS):
        print(f"错误：输入路径既不是有效目录，也不是支持的单个文件: {input_path}")
        sys.exit(1)


    print(f"--- 开始文件处理 ---")
    print(f"输入路径: {INPUT_BASE_DIR}")
    print(f"服务器 URL: {SERVER_URL}")
    print(f"最大线程数: {MAX_THREADS}")

    start_run_time = time.time()

    processor = FileProcessor(
        input_base_path=INPUT_BASE_DIR,
        url=SERVER_URL,
        verbose=VERBOSE_LEVEL,
        max_threads=MAX_THREADS,
        **kwargs  # 将 kwargs 传递给 FileProcessor
    )

    results_list = processor.process()

    end_run_time = time.time()
    print(f"\n--- 客户端运行结束 ---")
    print(f"总耗时: {end_run_time - start_run_time:.2f} 秒")