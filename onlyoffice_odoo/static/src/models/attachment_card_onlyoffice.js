/** @odoo-module **/

/*
 *
 * (c) Copyright Ascensio System SIA 2024
 *
 */

import { AttachmentList } from "@mail/core/common/attachment_list"
import { _t } from "@web/core/l10n/translation"
import { useService } from "@web/core/utils/hooks"
import { patch } from "@web/core/utils/patch"
import { onWillStart } from "@odoo/owl"

let formats = []
let formatsPromise = null
// Loaded on first use, not when the module loads: a fetch at module load
// runs in every bundle that includes this file, including the web unit-test
// bundle, where hoot rejects unmocked fetches and aborts the whole suite.
const loadFormats = () => {
  if (!formatsPromise) {
    formatsPromise = (async () => {
      try {
        const data = await fetch("/onlyoffice_odoo/static/assets/document_formats/onlyoffice-docs-formats.json")
        formats = await data.json()
      } catch (error) {
        console.error("Error loading formats data:", error)
      }
    })()
  }
  return formatsPromise
}

patch(AttachmentList.prototype, {
  setup() {
    super.setup(...arguments)
    this.orm = useService("orm")
    this.notification = useService("notification")
    this.actionService = useService("action")
    onWillStart(() => loadFormats())
  },
  // eslint-disable-next-line sort-keys
  onlyofficeCanOpen(attachment) {
    const format = formats.find((f) => f.name === attachment.extension.toLowerCase())
    return format && format.actions && (format.actions.includes("view") || format.actions.includes("edit"))
  },
  async openOnlyoffice(attachment) {
    const demo = JSON.parse(await this.orm.call("onlyoffice.odoo", "get_demo"))
    if (demo && demo.mode && demo.date) {
      const isValidDate = (d) => d instanceof Date && !isNaN(d)
      demo.date = new Date(Date.parse(demo.date))
      if (isValidDate(demo.date)) {
        const today = new Date()
        const difference = Math.floor((today - demo.date) / (1000 * 60 * 60 * 24))
        if (difference > 30) {
          this.notification.add(
            _t("The 30-day test period is over, you can no longer connect to demo ONLYOFFICE Docs server"),
            {
              title: _t("ONLYOFFICE Docs server"),
              type: "warning",
            },
          )
          return
        }
      }
    }
    const { same_tab } = JSON.parse(await this.orm.call("onlyoffice.odoo", "get_same_tab"))
    if (same_tab) {
      const action = {
        params: { attachment_id: attachment.id },
        tag: "onlyoffice_editor",
        target: "current",
        type: "ir.actions.client",
      }
      return this.actionService.doAction(action)
    }
    const accessTokenQuery = attachment.accessToken ? `?access_token=${attachment.accessToken}` : ""
    window.open(`/onlyoffice/editor/${attachment.id}${accessTokenQuery}`, "_blank")
  },
})
