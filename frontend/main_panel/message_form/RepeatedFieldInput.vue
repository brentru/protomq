<template>
  <div class="repeated-field">
    <label class="label">
      <p>
        <button @click="addItem">+</button>
        <button v-if="any" @click="removeItem">-</button>
        <span>repeated:</span>
      </p>

      <p>{{ field.fieldName }}</p>
    </label>

    <InputComponent v-for="(item, index) in items" :field="item" :fieldPath="fieldPath" :label="index"/>
  </div>
</template>

<script setup>
  import { ref, computed } from 'vue'
  import { cloneDeep } from 'lodash-es'
  import OneofInput from './OneofInput.vue'
  import EnumInput from './EnumInput.vue'
  import MessageInput from './MessageInput.vue'
  import PrimitiveInput from './PrimitiveInput.vue'
  import { useMessageStore } from '../../stores/message'
  import { useFieldPath } from './use_field_path'


  const
    props = defineProps(["field", "fieldPath"]),
    { setDeep, popDeep } = useMessageStore(),
    { nextFieldPath } = useFieldPath(props),

    items = ref([]),

    addItem = () => {
      // clone the field, append the array index to the name
      const newItem = cloneDeep(props.field)
      newItem.fieldName += `[${items.value.length}]`
      // make a path for the message
      const itemFieldPath = nextFieldPath + `[${items.value.length}]`
      // set the collection on the message
      setDeep(itemFieldPath, null)
      // add to our local item
      items.value.push(newItem)
    },

    removeItem = () => {
      // pop our collection
      items.value.pop()
      // and the message
      popDeep(nextFieldPath)
    },

    any = computed(() => items.value.length > 0),

    fieldTypeComponentMap = {
      oneof: OneofInput,
      message: MessageInput,
      enum: EnumInput,
      primitive: PrimitiveInput,
    },

    InputComponent = computed(() => fieldTypeComponentMap[props.field.fieldType])

  addItem()
</script>

<style>
  .repeated-field {
    border: 1px dashed lightgray;
    margin-left: 1.2em;
  }
</style>
