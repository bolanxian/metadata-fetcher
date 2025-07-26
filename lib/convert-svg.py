title = ""
host, port = "127.0.0.1", 8080
favicon = ""
output = None

import sys
from base64 import encodebytes
from pathlib import Path
from nicegui import ui, app


@ui.page("/")
async def index():
    async def on_click():
        button.set_enabled(False)
        success = False
        try:
            result = await ui.run_javascript(
                """
(async () => {
const image = document.querySelector('.fav-icon')
await new Promise((ok, reject) => {
    if (image.naturalHeight + image.naturalWidth > 0) { return ok() }
    image.addEventListener('load', ok)
    image.addEventListener('error', reject)
})
const img = await createImageBitmap(image)
const { width, height } = img
const canvas = new OffscreenCanvas(width, height)
canvas.getContext('2d').drawImage(img, 0, 0, width, height)
const type = 'image/png'
const blob = await canvas.convertToBlob({ type })
return blob
})()
""",
                timeout=5,
            )
            output.write_bytes(result)
            success = True
        finally:
            print("成功" if success else "失败")
            button.set_enabled(True)

    with (col := ui.column()):
        with ui.row():
            button = ui.button("点击我", on_click=on_click)
            button.classes("fav-click")
    ui.add_body_html(
        f'<img class="fav-icon" src="{favicon}">'
        """
<script>
    addEventListener('load',e=>{document.querySelector('.fav-click').click()})
</script>
"""
    )


def main():
    global favicon, output
    favicon = f"data:image/svg+xml;base64,{encodebytes(Path(sys.argv[1]).read_bytes()).decode()}"
    output = Path(sys.argv[2])
    ui.run(
        host=host,
        port=port,
        title=title,
        show=False,
        native=True,
        reload=False,
    )


if __name__ == "__main__":
    main()
