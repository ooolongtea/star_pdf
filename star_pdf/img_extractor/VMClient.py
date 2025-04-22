import os
import base64
from openai import OpenAI
import time

def load_base64_image(image_path: str) -> str:
    """
    读取本地图片并进行 base64 编码
    """
    with open(image_path, "rb") as image_file:
        encoded = base64.b64encode(image_file.read()).decode("utf-8")
    return f"data:image/jpeg;base64,{encoded}"


def ask_qwen_with_image(image_path: str, question: str) -> str:
    """
    发送本地图片 + 提问，获取 Qwen-VL 的回答
    """
    # 初始化 OpenAI 客户端（兼容 DashScope 协议）
    client = OpenAI(
        api_key="sk-4ff13f9364f44d74b0668a397d6bf8ab",
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    )

    # 编码图片为 base64
    base64_image = load_base64_image(image_path)

    # 构造消息
    messages = [
        {
            "role": "system",
            "content": [{"type": "text", "text": "You are a helpful assistant."}],
        },
        {
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": base64_image}},
                {"type": "text", "text": question},
            ],
        },
    ]

    # 调用模型
    completion = client.chat.completions.create(
        model="qwen2.5-vl-72b-instruct",
        messages=messages,
    )

    return completion.choices[0].message.content

# def process_all_images(root_dir: str, question: str = "这是一张化学反应图吗？仅返回答案YES或者NO"):
#     """
#     遍历 root_dir 下的所有子目录，查找 image 文件夹，并对其中图片提问。
#     如果模型回答包含 YES，则将图片名写入 reaction_img.txt。
#     """
#     for dirpath, dirnames, filenames in os.walk(root_dir):
#         if os.path.basename(dirpath) == "image":
#             image_dir = dirpath
#             output_path = os.path.join(os.path.dirname(image_dir), "reaction_img.txt")
#             matched_images = []

#             for file in os.listdir(image_dir):
#                 image_path = os.path.join(image_dir, file)
#                 if not os.path.isfile(image_path) or not file.lower().endswith((".jpg", ".jpeg", ".png")):
#                     continue

#                 try:
#                     answer = ask_qwen_with_image(image_path, question)
#                     time.sleep(0.2)
#                     print(f"[INFO] Processed: {file} -> {answer}")
#                     if "yes" in answer.lower():  # 根据需要可换成更精准的匹配
#                         matched_images.append(file)
#                 except Exception as e:
#                     print(f"[ERROR] Failed to process {file}: {e}")

#             if matched_images:
#                 with open(output_path, "w", encoding="utf-8") as f:
#                     f.write("\n".join(matched_images))
#                 print(f"[✔] Written {len(matched_images)} matches to: {output_path}")

# 是否有化学式
def process_all_images_formula(root_dir: str, question: str = "这张图包含化学式吗？仅返回答案YES或者NO"):
    """
    遍历 root_dir 下的所有子目录，查找 image 文件夹，并对其中图片提问。
    如果模型回答包含 YES，则将图片名写入 reaction_img.txt。
    """
    for dirpath, dirnames, filenames in os.walk(root_dir):
        if os.path.basename(dirpath) == "image":
            image_dir = dirpath
            output_path = os.path.join(os.path.dirname(image_dir), "formula_img.txt")
            matched_images = []

            for file in os.listdir(image_dir):
                image_path = os.path.join(image_dir, file)
                if not os.path.isfile(image_path) or not file.lower().endswith((".jpg", ".jpeg", ".png")):
                    continue

                try:
                    answer = ask_qwen_with_image(image_path, question)
                    time.sleep(0.2)
                    print(f"[INFO] Processed: {file} -> {answer}")
                    if "yes" in answer.lower():  # 根据需要可换成更精准的匹配
                        matched_images.append(file)
                except Exception as e:
                    print(f"[ERROR] Failed to process {file}: {e}")

            if matched_images:
                with open(output_path, "w", encoding="utf-8") as f:
                    f.write("\n".join(matched_images))
                print(f"[✔] Written {len(matched_images)} matches to: {output_path}")

if __name__ == "__main__":
    root_path = "/home/zhangxiaohong/zhouxingyu/retro_extractor/data/drug_CN_100"
    process_all_images_formula(root_path)

