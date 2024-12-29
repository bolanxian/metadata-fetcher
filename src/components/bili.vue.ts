
import { defineComponent, createVNode as h, watch, shallowReactive, withDirectives, onMounted } from 'vue'
import { ButtonGroup, Button, Card, Divider, Drawer, Icon, Tag, CellGroup, Cell } from 'view-ui-plus'
import lineClamp from 'view-ui-plus/src/directives/line-clamp'
import { instantToString, formatDuration } from '../utils/temporal'
import { $string, $array, hasOwn } from '../bind'
import { BBDown } from './bbdown'
const { slice, startsWith } = $string, { join } = $array

export const toShortUrl = (id: string) => `https://b23.tv/${id}`
export const toUrl = (id: string) => `https://www.bilibili.com/video/${id}/`
export const toSpaceUrl = (id: string) => `https://space.bilibili.com/${id}/`
export const copyrightMap = new Map([[1, '自制'], [2, '转载']])
export const copyrightValues = join([...copyrightMap.values()], ',')
export const enum ArgueType {
  NEUTRAL = 0,
  GENERAL_NEGATIVE = 1,
  STRONG_NEGATIVE = 2,
}
export const enum DescInfoType {
  ORDINARY = 1,
  USER_HREF = 2,
}
/*<component>*/
const createArgue = ({ argue_info }: any) => {
  let before = false
  let color = 'default'
  let type: string = null!
  const msg = argue_info?.argue_msg
  if (msg) switch (argue_info.argue_type) {
    case ArgueType.STRONG_NEGATIVE:
      before = true; color = 'error'; type = 'ios-alert'
      break
    case ArgueType.GENERAL_NEGATIVE:
      before = true; color = 'warning'; type = 'ios-alert'
      break
    case ArgueType.NEUTRAL:
      type = 'ios-alert-outline'
      break
  }
  const argue = msg ? h(Tag, { color }, () => [
    type != null ? h(Icon, { type }) : null, msg
  ]) : null
  return {
    before: before ? argue : null,
    after: before ? null : argue
  }
}

export default defineComponent({
  props: { data: null as any },
  setup(props, ctx) {
    const state = shallowReactive<{
      drawer: 'parts' | 'episodes' | null | undefined
      drawerTitle: string
    }>({
      drawer: void 0,
      drawerTitle: '',
    })
    onMounted(() => { state.drawer = null })
    let data: Record<'error' | 'thumb' | 'copyright' | 'pagesTitle' | 'episodesTitle', string | null>
      & Record<'channel' | 'subChannel', any>
    watch(() => props.data, ($data) => {
      data = {
        error: '',
        thumb: null,
        copyright: null,
        pagesTitle: '分P',
        episodesTitle: '合集',
        channel: null,
        subChannel: null,
      }
      if ($data == null) { return }
      const { error, channelKv, videoData } = $data
      data.error = error.message
      if (data.error != null) { return }
      data.thumb = videoData.pic ?? ''
      if (startsWith(data.thumb!, 'http:')) {
        data.thumb = `https:${slice(data.thumb!, 5)}`
      }
      data.copyright = copyrightMap.get(videoData.copyright) ?? '未知'
      data.pagesTitle = `分P[${videoData.pages.length}]`
      if (videoData.ugc_season != null) {
        const { title, ep_count } = videoData.ugc_season
        data.episodesTitle = `${title}[${ep_count}]`
      }
      if (channelKv != null) {
        for (const channel of channelKv) {
          if (!hasOwn(channel, 'sub')) { continue }
          for (const sub of channel.sub) {
            if (sub.tid === videoData.tid && sub.name === videoData.tname) {
              data.channel = channel
              data.subChannel = sub
              return
            }
          }
        }
        for (const channel of channelKv) {
          if (channel.tid === videoData.tid && channel.name === videoData.tname) {
            data.channel = channel
            data.subChannel = null
            return
          }
        }
      }
      data.channel = { name: videoData.tname, url: '#' }
      data.subChannel = null
    }, { immediate: true })
    const handle = {
      drawerParts() {
        state.drawer = 'parts'
        state.drawerTitle = data.pagesTitle!
      },
      drawerEpisodes() {
        state.drawer = 'episodes'
        state.drawerTitle = data.episodesTitle!
      },
      drawerModelValue(_: boolean) { _ || (state.drawer = null) }
    }

    const $a = { referrerpolicy: 'no-referrer', target: '_blank' }
    const $img = { referrerpolicy: 'no-referrer' }
    return () => {
      if (data.error != null) {
        return [
          h(Card, null, () => [h(Tag, { color: 'error' }, () => [data.error])])
        ]
      }
      const { tags, videoData } = props.data
      const id = `av${videoData.aid}`
      return [
        h(Card, null, {
          title: () => {
            const { before, after } = createArgue(videoData)
            return [
              withDirectives(h('div', {
                style: 'margin-right:40px;line-height:1.2em;font-size:1.2em', title: videoData.title
              }, [videoData.title]), [
                [lineClamp, 1]
              ]),
              h('div', null, [
                before,
                h(Tag, { color: 'blue', title: '30小时制' }, () => [
                  instantToString(videoData.pubdate * 1000, true)
                ]),
                after
              ])
            ]
          },
          extra: () => Array.from(videoData.staff ?? [videoData.owner], (owner: any) => h('a', {
            ...$a, class: 'ivu-avatar ivu-avatar-square ivu-avatar-image ivu-avatar-large',
            href: toSpaceUrl(owner.mid),
            title: `${owner.title != null ? `[${owner.title}]` : ''}${owner.name}`
          }, [
            h('img', { ...$img, src: owner.face })
          ])),
          default: () => [
            h('div', null, [
              data.channel != null ? h('a', { ...$a, href: data.channel.url }, [
                h(Tag, { color: 'blue' }, () => [data.channel.name])
              ]) : null,
              data.subChannel != null ? h('a', { ...$a, href: data.subChannel.url, title: data.subChannel.desc }, [
                h(Tag, { color: 'blue' }, () => [data.subChannel.name])
              ]) : null,
              h(Tag, { color: 'cyan', title: `视频类型[${copyrightValues}]` }, () => [data.copyright]),
              h('a', { ...$a, href: toUrl(id) }, [
                h(Tag, { color: 'blue' }, () => [id])
              ]),
              h('a', { ...$a, href: toUrl(videoData.bvid) }, [
                h(Tag, { color: 'blue' }, () => [videoData.bvid])
              ]),
            ]),
            h('div', null, Array.from(tags, (tag: any) => {
              switch (tag.tag_type ?? null) {
                case 'bgm':
                  return h('a', { ...$a, href: tag.jump_url }, [
                    h(Tag, { color: 'primary' }, () => [h(Icon, { type: 'ios-musical-notes' }), tag.tag_name])
                  ])
                case 'topic':
                  return h('a', { ...$a, href: tag.jump_url }, [
                    h(Tag, { color: 'primary' }, () => [h(Icon, { type: 'ios-paper-plane' }), tag.tag_name])
                  ])
                case 'old_channel': case null:
                  return h(Tag, null, () => [tag.tag_name])
              }
              return null
            })),
            h('img', {
              ...$img, style: 'margin-top:16px;width:100%',
              src: data.thumb, title: data.thumb
            }),
            h(Divider, { style: 'margin:16px 0' }),
            h('div', {
              title: `动态${videoData.dynamic ? '' : '为空'}`, style: 'white-space:pre-line'
            }, [videoData.dynamic || '\u200B']),
            h(Divider, { style: 'margin:16px 0' }),
            h('div', {
              title: `简介${videoData.desc_v2 != null ? '' : '为空'}`, style: 'white-space:pre-line'
            }, Array.from(videoData.desc_v2 ?? [{ type: 1, raw_text: '\u200B' }], (_: any) => {
              switch (_.type) {
                case DescInfoType.ORDINARY: return _.raw_text
                case DescInfoType.USER_HREF: return h('a', { ...$a, href: toSpaceUrl(_.biz_id) }, [`@${_.raw_text} `])
              }
            })),
            h(Divider, { style: 'margin:16px 0' }),
            h(ButtonGroup, null, () => [
              h(Button, {
                onClick: handle.drawerParts
              }, () => [data.pagesTitle]),
              h(Button, {
                disabled: videoData.ugc_season == null,
                onClick: handle.drawerEpisodes
              }, () => [data.episodesTitle]),
              h(BBDown, { id })
            ]),
            state.drawer !== void 0 ? h(Drawer, {
              width: 512,
              title: state.drawerTitle,
              modelValue: state.drawer != null,
              'onUpdate:modelValue': handle.drawerModelValue
            }, () => [
              state.drawer == 'parts' ? h(CellGroup, null, () => Array.from(
                videoData.pages, (page: any) => h(Cell, {
                  title: page.part,
                  extra: formatDuration(page.duration)
                }, {
                  label: () => [
                    h('a', { ...$a, href: `${toUrl(id)}?p=${page.page}` }, [`cid:${page.cid}`])
                  ]
                })
              )) : null,
              state.drawer == 'episodes' ? Array.from(
                videoData.ugc_season.sections ?? [], (section: any) => h(Card, {
                  title: `${section.title}[${section.episodes.length}]`
                }, () => [
                  h(CellGroup, null, () => Array.from(
                    section.episodes, (episode: any) => h(Cell, {
                      title: episode.title,
                      extra: formatDuration(episode.arc.duration),
                      selected: videoData.aid == episode.aid
                    }, {
                      label: () => {
                        const id = `av${episode.aid}`
                        return [h('a', { ...$a, href: toUrl(id) }, [id])]
                      }
                    })
                  ))
                ])
              ) : null
            ]) : null
          ]
        })
      ]
    }
  }
})